import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { mapPixKeyType } from "@/lib/acquirers/misticpay";
import { getAcquirerForUser, createWithdrawal } from "@/lib/acquirers";
import { notifyWithdrawalCompleted, notifyWithdrawalFailed } from "@/lib/notifications";

import { logWithdrawalStatusUpdate, logAdminAction } from "@/lib/discord-webhook";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar se e admin
    
    
    
    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    if (!action || !["approve", "reject", "mark_paid"].includes(action)) {
      return NextResponse.json(
        { error: "Ação inválida. Use 'approve', 'reject' ou 'mark_paid'." },
        { status: 400 }
      );
    }

    // Buscar o saque
    const withdrawalResult = await sql`
      SELECT w.*, p.id as profile_id, p.name as profile_name, p.email as profile_email, p.balance as profile_balance
      FROM withdrawals w
      LEFT JOIN profiles p ON w.user_id = p.id
      WHERE w.id = ${id}
    `;

    if (withdrawalResult.length === 0) {
      return NextResponse.json(
        { error: "Saque não encontrado" },
        { status: 404 }
      );
    }

    const withdrawal = withdrawalResult[0];

    // Ação mark_paid
    if (action === "mark_paid") {
      if (!["approved", "processing"].includes(withdrawal.status)) {
        return NextResponse.json(
          { error: "Apenas saques aprovados ou em processamento podem ser marcados como pagos." },
          { status: 400 }
        );
      }

      await sql`
        UPDATE withdrawals
        SET status = 'completed', processed_at = NOW()
        WHERE id = ${id}
      `;

      const markPaidGross = Number(withdrawal.amount) || 0;
      const markPaidFee = Number(withdrawal.fee) || 0;
      const markPaidNet = Number(withdrawal.net_amount) || markPaidGross - markPaidFee;
      const markPaidPixKey = withdrawal.pix_key || "";
      
      // Enviar notificacao com push
      await notifyWithdrawalCompleted(withdrawal.user_id, markPaidGross, markPaidNet, markPaidFee, markPaidPixKey);
      console.log(`[Admin Withdrawal] Push notification enviado para usuario ${withdrawal.user_id}`);

      try {
        await sql`
          INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
          VALUES (${crypto.randomUUID()}, ${withdrawal.user_id}, ${'WITHDRAWAL_COMPLETED'}, ${'withdrawal'}, ${id}, ${JSON.stringify({ amount: markPaidGross })}, NOW())
        `;
      } catch (auditError) {
        console.error("Error creating audit log:", auditError);
      }
      
      // Log para Discord
      logWithdrawalStatusUpdate({
        withdrawalId: id,
        userName: withdrawal.profile_name || "N/A",
        userEmail: withdrawal.profile_email || "",
        amount: markPaidGross,
        netAmount: markPaidNet,
        oldStatus: withdrawal.status,
        newStatus: "completed",
        pixKey: markPaidPixKey,
        adminName: admin.name || "Admin",
      });
      
      logAdminAction({
        adminName: admin.name || "Admin",
        adminEmail: admin.email || "",
        action: "Saque Marcado como Pago",
        target: `${withdrawal.profile_name} (${withdrawal.profile_email})`,
        details: `Valor: R$ ${markPaidNet.toFixed(2)}`,
      });

      return NextResponse.json({
        success: true,
        message: "Saque marcado como pago!",
        status: "completed",
      });
    }

    if (withdrawal.status !== "pending") {
      return NextResponse.json(
        { error: `Este saque já foi ${withdrawal.status === "completed" ? "concluído" : withdrawal.status === "rejected" ? "rejeitado" : "processado"}.` },
        { status: 400 }
      );
    }

    if (action === "approve") {
      // Buscar adquirente correta baseada na rota do usuário
      const acquirer = await getAcquirerForUser(withdrawal.user_id);
      
      if (!acquirer) {
        return NextResponse.json({
          success: false,
          error: "Nenhuma adquirente configurada para a rota deste usuário.",
          acquirerName: "Não configurada",
        }, { status: 400 });
      }

      // Usar a função createWithdrawal que já trata a lógica da adquirente correta
      // createWithdrawal(amount, pixKey, userId?, pixKeyType?, description?)
      const withdrawalApiResult = await createWithdrawal(
        Number(withdrawal.net_amount), // Valor líquido a ser transferido
        withdrawal.pix_key,
        withdrawal.user_id,
        withdrawal.pix_key_type || mapPixKeyType(withdrawal.pix_key),
        `Saque LegacyPay - ${withdrawal.profile_name || withdrawal.profile_email}`
      );

      if (!withdrawalApiResult.success) {
        const errorMessage = withdrawalApiResult.error || "Erro ao processar saque";
        const isInsufficientBalance = errorMessage.toLowerCase().includes("saldo") || errorMessage.toLowerCase().includes("insufficient");
        const approveErrorAmount = Number(withdrawal.amount) || 0;

        try {
          await sql`
            INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
            VALUES (${crypto.randomUUID()}, ${withdrawal.user_id}, ${'WITHDRAWAL_FAILED'}, ${'withdrawal'}, ${id}, ${JSON.stringify({ amount: approveErrorAmount, error: errorMessage })}, NOW())
          `;
        } catch (auditError) {
          console.error("Error creating audit log:", auditError);
        }

        return NextResponse.json({
          success: false,
          error: isInsufficientBalance 
            ? `Saldo insuficiente na conta da adquirente.`
            : `Erro ao processar saque: ${errorMessage}`,
          insufficientBalance: isInsufficientBalance,
          acquirerName: acquirer.name,
        }, { status: 400 });
      }

      const acquirerWithdrawalId = String(withdrawalApiResult.withdrawalId || "");
      const approveSuccessAmount = Number(withdrawal.amount) || 0;

      await sql`
        UPDATE withdrawals
        SET status = 'processing', acquirer_withdrawal_id = ${acquirerWithdrawalId}, approved_at = NOW()
        WHERE id = ${id}
      `;

      await sql`
        INSERT INTO user_notifications (id, user_id, title, message, type, created_at)
        VALUES (${crypto.randomUUID()}, ${withdrawal.user_id}, ${'Saque Aprovado'}, ${`Seu saque de R$ ${approveSuccessAmount.toFixed(2)} foi aprovado e está sendo processado.`}, ${'success'}, NOW())
      `;

      try {
        await sql`
          INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
          VALUES (${crypto.randomUUID()}, ${withdrawal.user_id}, ${'WITHDRAWAL_APPROVED'}, ${'withdrawal'}, ${id}, ${JSON.stringify({ amount: approveSuccessAmount, acquirer_id: acquirerWithdrawalId })}, NOW())
        `;
      } catch (auditError) {
        console.error("Error creating audit log:", auditError);
      }
      
      // Log para Discord
      logWithdrawalStatusUpdate({
        withdrawalId: id,
        userName: withdrawal.profile_name || "N/A",
        userEmail: withdrawal.profile_email || "",
        amount: approveSuccessAmount,
        netAmount: Number(withdrawal.net_amount) || 0,
        oldStatus: "pending",
        newStatus: "processing",
        pixKey: withdrawal.pix_key || "",
        adminName: admin.name || "Admin",
      });
      
      logAdminAction({
        adminName: admin.name || "Admin",
        adminEmail: admin.email || "",
        action: "Saque Aprovado",
        target: `${withdrawal.profile_name} (${withdrawal.profile_email})`,
        details: `Valor: R$ ${(Number(withdrawal.net_amount) || 0).toFixed(2)} | Acquirer ID: ${acquirerWithdrawalId}`,
      });

      return NextResponse.json({
        success: true,
        message: "Saque aprovado e enviado para processamento!",
        status: "processing",
        acquirerWithdrawalId,
      });

    } else if (action === "reject") {
      // Garantir que os valores são números
      const currentBalance = Number(withdrawal.profile_balance) || 0;
      const withdrawalAmount = Number(withdrawal.amount) || 0;
      const newBalance = currentBalance + withdrawalAmount;

      // Atualizar saldo do usuário (devolver o valor)
      await sql`
        UPDATE profiles SET balance = ${newBalance}, updated_at = NOW() WHERE id = ${withdrawal.user_id}
      `;

      // Atualizar status do saque
      await sql`
        UPDATE withdrawals 
        SET status = 'rejected', 
            processed_at = NOW()
        WHERE id = ${id}
      `;

      // Enviar notificacao com push para o usuario
      try {
        await notifyWithdrawalFailed(withdrawal.user_id, withdrawalAmount, reason || "Rejeitado pelo administrador");
        console.log(`[Admin Withdrawal] Push notification de rejeicao enviado para usuario ${withdrawal.user_id}`);
      } catch (notifError) {
        console.error("[Admin Withdrawal] Error sending rejection notification:", notifError);
      }

      // Criar log de auditoria
      try {
        await sql`
          INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
          VALUES (${crypto.randomUUID()}, ${withdrawal.user_id}, ${'WITHDRAWAL_REJECTED'}, ${'withdrawal'}, ${id}, ${JSON.stringify({ amount: withdrawalAmount, reason, refunded_balance: newBalance })}, NOW())
        `;
      } catch (auditError) {
        console.error("Error creating audit log:", auditError);
      }
      
      // Log para Discord
      logWithdrawalStatusUpdate({
        withdrawalId: id,
        userName: withdrawal.profile_name || "N/A",
        userEmail: withdrawal.profile_email || "",
        amount: withdrawalAmount,
        netAmount: Number(withdrawal.net_amount) || 0,
        oldStatus: "pending",
        newStatus: "rejected",
        pixKey: withdrawal.pix_key || "",
        adminName: admin.name || "Admin",
      });
      
      logAdminAction({
        adminName: admin.name || "Admin",
        adminEmail: admin.email || "",
        action: "Saque Rejeitado",
        target: `${withdrawal.profile_name} (${withdrawal.profile_email})`,
        details: `Valor: R$ ${withdrawalAmount.toFixed(2)} | Motivo: ${reason || "Nao informado"}`,
      });

      return NextResponse.json({
        success: true,
        message: "Saque rejeitado e saldo devolvido ao usuário.",
        status: "rejected",
        refundedAmount: withdrawalAmount,
        newBalance: newBalance,
      });
    }

  } catch (error) {
    console.error("Error processing withdrawal action:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao processar ação" },
      { status: 500 }
    );
  }
}

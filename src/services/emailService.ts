// Autor: Nícolas Mitjans Nunes

import nodemailer from "nodemailer";

export async function enviarEmailRecuperacao(destinatario: string, token: string) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false, // Porta 587 = STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to: destinatario,
    subject: "Recuperação de senha - Nota Dez",
    text: `Seu token de recuperação é: ${token}`,
  };

  await transporter.sendMail(mailOptions);
  console.log("✅ E-mail enviado com sucesso para:", destinatario);
}

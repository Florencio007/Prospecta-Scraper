import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testSMTP() {
  console.log('--- Test SMTP Infomaniak ---');
  console.log(`Host: ${process.env.SMTP_HOST}`);
  console.log(`User: ${process.env.SMTP_USER}`);
  console.log(`Password length: ${process.env.SMTP_PASS?.length || 0}`);

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    await transporter.verify();
    console.log('✅ Connexion SMTP réussie !');

    const info = await transporter.sendMail({
      from: `"${process.env.DEFAULT_SENDER_NAME}" <${process.env.DEFAULT_SENDER_EMAIL}>`,
      to: process.env.SMTP_USER, // S'envoyer un mail à soi-même
      subject: 'Test Prospecta - Validation SMTP',
      text: 'Ceci est un test de validation de la configuration SMTP Infomaniak pour Prospecta.',
      html: '<b>Ceci est un test de validation</b> de la configuration SMTP Infomaniak pour Prospecta.'
    });

    console.log('✅ Email de test envoyé ! ID:', info.messageId);
    console.log(`Vérifiez la boîte de réception de ${process.env.SMTP_USER}`);
  } catch (error) {
    console.error('❌ Erreur SMTP :', error.message);
  }
}

testSMTP();

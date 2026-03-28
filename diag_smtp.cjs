const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSMTP() {
  console.log('Testing SMTP connection...');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

  try {
    console.log('Verifying transporter...');
    await transporter.verify();
    console.log('✅ SMTP Connection successful');
  } catch (err) {
    console.error('❌ SMTP Connection failed:', err.message);
  }
}

testSMTP();

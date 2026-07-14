const nodemailer = require("nodemailer");
const { defineSecret, defineString } = require("firebase-functions/params");

// Estos valores se configuran una sola vez con:
//   firebase functions:secrets:set SMTP_USER
//   firebase functions:secrets:set SMTP_PASS
//   firebase functions:config:set (o variables .env para 2nd gen, ver README de functions)
const SMTP_HOST = defineString("SMTP_HOST", { default: "smtp.gmail.com" });
const SMTP_PORT = defineString("SMTP_PORT", { default: "465" });
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const ALERTS_FROM_NAME = defineString("ALERTS_FROM_NAME", { default: "Pulso CMMS Biomédico" });

// Lista de secretos/params que cada función que envíe correo debe declarar en sus opciones,
// p. ej.: onSchedule("...", { secrets: MAIL_SECRETS }, handler)
const MAIL_SECRETS = [SMTP_USER, SMTP_PASS];

function getTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST.value(),
    port: Number(SMTP_PORT.value()),
    secure: Number(SMTP_PORT.value()) === 465,
    auth: {
      user: SMTP_USER.value(),
      pass: SMTP_PASS.value(),
    },
  });
}

async function enviarCorreo({ to, subject, html }) {
  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.log("Sin destinatarios para el correo:", subject);
    return;
  }
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"${ALERTS_FROM_NAME.value()}" <${SMTP_USER.value()}>`,
    to: Array.isArray(to) ? to.join(",") : to,
    subject,
    html,
  });
}

module.exports = { enviarCorreo, MAIL_SECRETS };

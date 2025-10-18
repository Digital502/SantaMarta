import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST_PAGO,
  port: Number(process.env.EMAIL_PORT_PAGO),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER_PAGO,
    pass: process.env.EMAIL_PASS_PAGO,
  },
});

export const enviarFactura = async (to, asunto, html, attachments = []) => {
  return transporter.sendMail({
    from: `"Hermandad de Jesús Nazareno Redentor de los Cautivos y Virgen de Dolores" <hermandadsantamartazona3@gmail.com>`,
    to,
    subject: asunto,
    html,
    attachments,
  });
};

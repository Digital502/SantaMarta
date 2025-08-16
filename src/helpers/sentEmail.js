import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

export const sendEmail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({     
    host: process.env.EMAIL_HOST,       
    port: Number(process.env.EMAIL_PORT), 
    secure: false,             
    auth: {
      user: process.env.EMAIL_USER, 
      pass: process.env.EMAIL_PASS    
    }
  });

  await transporter.sendMail({
    from: `"Digital Fact" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  });
};

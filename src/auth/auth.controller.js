import { hash, verify } from "argon2"
import User from "../user/user.model.js"
import { generateJWT } from "../helpers/generate-jwt.js";
import { generatePassword } from "../helpers/user-fuctions.js";
import nodemailer from "nodemailer"
import { sendEmail } from "../helpers/sentEmail.js";

export const register = async (req, res) => {
    try {
        const data = req.body;
        const contraseña = generatePassword();
        const encryptPassword = await hash(contraseña);
        data.contraseña = encryptPassword

        const user = await User.create(data);

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8" />
            <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #E0E1DD;
                margin: 0;
                padding: 40px 20px;
            }

            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #142130;
                border-radius: 16px;
                padding: 32px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                color: #E0E1DD;
            }

            h2 {
                text-align: center;
                color: #86AFB9;
                margin-bottom: 10px;
            }

            .subtitle {
                font-size: 18px;
                color: #59818B;
                text-align: center;
                margin-bottom: 24px;
            }

            .info {
                background-color: #1e293b;
                border-left: 6px solid #59818B;
                padding: 20px;
                border-radius: 10px;
                margin-bottom: 24px;
            }

            .info p {
                margin: 10px 0;
                font-size: 15px;
                color: #E0E1DD;
            }

            .warning {
                background-color: #1e293b;
                border-left: 6px solid #FFD700;
                color: #FFD700;
                padding: 16px;
                font-size: 14px;
                border-radius: 10px;
                margin-bottom: 24px;
            }

            .cta {
                display: inline-block;
                background-color: #2B535C;
                color: #ffffff;
                padding: 12px 24px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: bold;
                text-align: center;
                margin: 0 auto;
                transition: background 0.3s ease;
            }

            .cta:hover {
                background-color: #426A73;
            }

            .footer {
                text-align: center;
                font-size: 12px;
                color: #86AFB9;
                margin-top: 30px;
            }
            </style>
        </head>
        <body>
            <div class="container">
            <h2>Hermandad de Jesús Nazareno Redentor de los Cautivos</h2>
            <p class="subtitle">${user.nombre} ${user.apellido}!</p>

            <div class="info">
                <p><strong>📧 Correo:</strong> ${user.email}</p>
                <p><strong>🔐 Contraseña:</strong> ${contraseña}</p>
            </div>

            <div class="warning">
                ⚠️ Por favor, guarda esta información en un lugar seguro y no compartas tus credenciales con nadie.
            </div>

            <div class="footer">
                © ${new Date().getFullYear()} Hermandad de Jesús Nazareno Redentor de los Cautivos. Todos los derechos reservados.
            </div>
            </div>
        </body>
        </html>
        `;

        await sendEmail({
            to: user.email,
            subject: 'Registro Exitoso - Tus Credenciales',
            html: htmlContent,
        });

        return res.status(201).json({
            message: "You have successfully registered",
            nombre: user.nombre,
            apellido: user.apellido,
            email: user.email,
            role: user.role
        });
    } catch (err) {
        return res.status(500).json({
            message: "User registration failed",
            error: err.message
        });
    }
}

export const login = async (req, res) => {
    try {
        const { email, contraseña } = req.body;
        const acces = await User.findOne({ $or: [{ email: email }] });

        if (!acces) {
            return res.status(400).json({
                message: "Invalid credential",
                error: "There is no user with the entered email"
            })
        }

        const validatorPassword = await verify(acces.contraseña, contraseña)

        if (!validatorPassword) {
            return res.status(400).json({
                message: "Invalid credentials",
                error: "The password is incorrect"
            })
        }

        const webToken = await generateJWT(acces._id)
        return res.status(200).json({
            message: "login successful",
            userDetails: {
                token: webToken,
                role: acces.role,
                nombre: acces.nombre,
                apellido: acces.apellido,
            }
        })
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            message: "login failed, server error",
            error: err.message

        })
    }
}
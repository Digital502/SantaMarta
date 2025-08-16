import User from "../user/user.model.js";
import { hash } from "argon2";
import { generate } from "generate-password";

export const defaultUser = async () => {
    try {
        const user = await User.findOne({ nombre: "Admin" });
        if (!user) {

            const encryptPassword = await hash("SMredentor#?2527");

            const newUser = new User({
                nombre: "Admin",
                apellido: "Admin",
                email: "admin@redentordl.com",
                DPI: "1234567890101",
                contraseña: encryptPassword,
                telefono: "00000000",
                direccion: "3 Avenida 24-53 Zona 3",
                role: "ROL_DIRECTIVO",
            });

            await newUser.save();
        }
    } catch (err) {
        console.error("Error creating default user:", err);
    }
}


export const generatePassword = () => {
    return generate({
        length: 8,
        numbers: true,
        uppercase: true,
        excludeSimilarCharacters: true,
        strict: true
    });
}
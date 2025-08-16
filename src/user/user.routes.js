import { Router } from "express";
import { getMyUser, getUsers, getUser, getDeleteUser, modificarContraseña, updateMyProfile, getUpdateDirectivoUser } from "./user.controller.js";
import { validateAuth, validateLogin } from "../middlewares/auth-validate.js";

const router = Router();

//Datos del usuario 
router.get("/getMyUser", validateAuth, getMyUser);

//Todos los usuarios
router.get("/getUsers", validateLogin, getUsers);

// Obtener un usuario por ID pero solo lo puede ver un usuario con rol de directivo
router.get("/getUser/:id", validateLogin, getUser);

// Eliminar un usuario por ID pero solo lo puede hacer un usuario con rol de directivo
router.delete("/getDeleteUser/:id", validateLogin, getDeleteUser);

// Actualizar un usuario por ID pero solo lo puede hacer un usuario con rol de directivo
router.put("/getUpdateUser/:id", validateLogin, getUpdateDirectivoUser);

router.put("/updatePassword", validateAuth, modificarContraseña);

router.put("/updateMyUser/:id", validateAuth, updateMyProfile);


export default router;
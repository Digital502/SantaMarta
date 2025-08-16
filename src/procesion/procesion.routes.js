import { Router } from "express";
import { addProcesion, getProcesiones, getProcesionById, deleteProcesion, updateProcesion } from "./procesion.controller.js";
import { validateAuth, validateLogin, validateLoginRoles } from "../middlewares/auth-validate.js";

const router = Router();

//lista todas las procesiones
router.get("/getProcesiones", validateLoginRoles, getProcesiones);

//Busca una procesion
router.get("/getProcesionesById/:id", validateLoginRoles, getProcesionById)

//Añade una procesion
router.post("/addProcesiones", validateLogin, addProcesion)

//Actualiza una procesion
router.put("/updateProcesion/:id", validateLogin, updateProcesion)

//Elimina una procesion 
router.delete("/deleteProcesion/:id", validateLogin, deleteProcesion)

export default router;
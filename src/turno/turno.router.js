import { Router } from "express";
import { validateLogin, validateLoginRoles } from "../middlewares/auth-validate.js"
import { addTurno, deleteTurno, downloadTurnosPdf, getTurnoById, getTurnos, getTurnosByProcesionId, updateTurno } from "./turno.controller.js";

const router = Router();

router.post("/addTurno", validateLogin, addTurno)

router.get("/getTurnos", validateLoginRoles, getTurnos)

router.get("/getTurnoById/:id", validateLoginRoles, getTurnoById)

router.put("/updateTurno/:id", validateLogin, updateTurno)

router.delete("/deleteTurno/:id", validateLogin, deleteTurno)

//Funcionalidades
router.get("/getTurnosByProcesion/:procesionId", validateLoginRoles, getTurnosByProcesionId);

router.get("/descargarInventario/:procesionId", validateLogin, downloadTurnosPdf);

export default router;
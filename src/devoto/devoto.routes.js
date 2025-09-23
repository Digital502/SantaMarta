import { Router } from "express";
import { validateLoginRoles } from "../middlewares/auth-validate.js";
import { addDevoto, deleteDevoto, getDevotoById, getDevotos, getDevotosByTurno, updateDevoto } from "./devoto.controller.js";

const router = Router();

router.post("/addDevoto", validateLoginRoles, addDevoto);

router.get("/getDevotos", validateLoginRoles, getDevotos);

router.get("/getDevotoById/:id", validateLoginRoles, getDevotoById);

router.put("/updateDevoto/:id", validateLoginRoles, updateDevoto);

router.delete("/deleteDevoto/:id", validateLoginRoles, deleteDevoto);

router.get("/devotosByTurno/:turnoId", validateLoginRoles, getDevotosByTurno);

router.get("/search/", validateLoginRoles, searchDevotos);

export default router;
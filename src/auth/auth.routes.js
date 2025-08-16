import { Router } from "express";
import { register, login } from "./auth.controller.js";
import { validateRegister, validatorLogin, } from "../middlewares/validate-user.js";
import { validateLogin } from "../middlewares/auth-validate.js";

const router = Router();

router.post("/register", validateLogin, validateRegister, register);

router.post("/login", validatorLogin, login);

export default router;
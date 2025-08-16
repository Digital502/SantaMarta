import { body, param } from "express-validator";
import { validateJWT } from "./validate-jwt.js";
import { hasRoles } from "./validate-roles.js";

export const validateLogin = [
    validateJWT,
    hasRoles("ROL_DIRECTIVO"),
]

export const validateAuth = [
    validateJWT,
]

export const validateLoginRoles = [
    validateJWT,
    hasRoles("ROL_DIRECTIVO", "ROL_GENERAL"),
]
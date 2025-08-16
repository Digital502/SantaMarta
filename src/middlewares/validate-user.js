import { body, param } from "express-validator";
import { handleErrors } from "./handle-errors.js";
import { validarCampos } from "./validar-campos.js";

export const validateRegister = [
  body("nombre")
    .notEmpty()
    .withMessage("El nombre es requerido")
    .isLength({ max: 30 })
    .withMessage("El nombre no puede exceder los 30 caracteres"),
  body("apellido")
    .notEmpty()
    .withMessage("El apellido es requerido")
    .isLength({ max: 30 })
    .withMessage("El apellido no puede exceder los 30 caracteres"),
  body("DPI")
    .notEmpty()
    .withMessage("El DPI es requerido")
    .isLength({ min: 13, max: 13 })
    .withMessage("El DPI debe tener 13 caracteres"),
  body("email")
    .notEmpty()
    .withMessage("El email es requerido")
    .isEmail()
    .withMessage("El email no es válido"),
  body("telefono")
    .notEmpty()
    .withMessage("El teléfono es requerido")
    .isLength({ min: 8 })
    .withMessage("El teléfono debe tener al menos 8 caracteres"),
  validarCampos,
  handleErrors,
];

export const validatorLogin = [
  body("email")
    .notEmpty()
    .withMessage("El email es requerido")
    .isEmail()
    .withMessage("El email no es válido"),
  body("contraseña").notEmpty().withMessage("La contraseña es requerida"),
  validarCampos,
  handleErrors,
];

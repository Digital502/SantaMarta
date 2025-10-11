import { Router } from "express";
import { validateLogin, validateLoginRoles } from "../middlewares/auth-validate.js";
import { crearCompra, editarFactura, eliminarFactura, getFacturaById, historialVentasPorUsuario, listFacturas, pagarComision, reservarTurno, registrarPago, generarFacturaPDF, pagarOrdinario, ventasPorProcesion } from "./compra.controller.js";

const router = Router();

router.post("/registrarCompra", validateLoginRoles, crearCompra)

router.get("/listFacturas", validateLogin, listFacturas)

router.get("/facturaById/:id", validateLogin, getFacturaById)

router.put("/updateFactura/:id", validateLogin, editarFactura)

router.delete("/deleteFactura/:id", validateLogin, eliminarFactura)

router.get("/historialVenta/:id", validateLogin, historialVentasPorUsuario)

router.put("/pagarComision", validateLoginRoles, pagarComision)

router.post("/reservarTurno", validateLogin, reservarTurno )

router.put("/registrarPago", validateLogin, registrarPago  )

router.get("/generarFacturaPDF/:noFactura", validateLoginRoles, generarFacturaPDF);

router.post("/pagoOrdinario", validateLoginRoles, pagarOrdinario)

router.get("/ventasPorProcesion/:procesionId", validateLoginRoles, ventasPorProcesion);

export default router;
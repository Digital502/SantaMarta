import Compra from "./compra.model.js";
import Devoto from "../devoto/devoto.model.js";
import Turno from "../turno/turno.model.js";
import Procesion from "../procesion/procesion.model.js";
import PDFDocument from 'pdfkit';
import path  from "path";
import fs from "fs";
import blobStream from 'blob-stream';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const crearCompra = async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    const { devoto: devotoId, turno: turnoId } = req.body;

    if (!usuarioId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    // Buscar devoto, turno y procesión
    const devoto = await Devoto.findById(devotoId);
    if (!devoto) return res.status(404).json({ error: "Devoto no encontrado" });

    const turno = await Turno.findById(turnoId);
    if (!turno) return res.status(404).json({ error: "Turno no encontrado" });

    const procesion = await Procesion.findById(turno.procesion);
    if (!procesion)
      return res.status(404).json({ error: "Procesión no encontrada" });

    // Verificar disponibilidad y descontar
    if (turno.cantidadSinVender > 0) {
      turno.cantidadSinVender -= 1;
      turno.cantidadVendida += 1;
      await turno.save();
    } else {
      return res
        .status(400)
        .json({ error: "No hay turnos disponibles para vender" });
    }

    // === Generar noFactura por procesión ===
    const totalComprasProcesion = await Compra.countDocuments({
      turno: {
        $in: await Turno.find({ procesion: procesion._id }).distinct("_id"),
      },
    });

    const inicialesProcesion = procesion.nombre
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase();

    const numeroFactura = `FAC${inicialesProcesion}${(totalComprasProcesion + 1)
      .toString()
      .padStart(4, "0")}`;

    // === Generar contraseña asociada al turno dentro de devoto.turnos ===
    let nuevaContraseña = "";

    if (turno.tipoTurno === "ORDINARIO") {
      const totalComprasOrdinario = await Compra.countDocuments({
        turno: {
          $in: await Turno.find({
            procesion: procesion._id,
            tipoTurno: "ORDINARIO",
          }).distinct("_id"),
        },
      });

      const nuevoNumero = (totalComprasOrdinario + 1).toString().padStart(4, "0");
      nuevaContraseña = `OR${inicialesProcesion}${nuevoNumero}`;
    } else if (turno.tipoTurno === "COMISION") {
      const inicialesTurno = turno.noTurno
        .toString()
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase();

      const turnosMismaProcesion = await Turno.find({
        procesion: procesion._id,
        tipoTurno: "COMISION",
      }).distinct("_id");

      const devotosMismaProcesion = await Devoto.find({
        "turnos.turnoId": { $in: turnosMismaProcesion },
      });

      let numerosExistentes = [];

      for (const d of devotosMismaProcesion) {
        for (const t of d.turnos) {
          if (t?.turnoId?.toString() === turno._id.toString() && typeof t?.contraseñas === "string") {
            const regex = new RegExp(`^${inicialesTurno}${inicialesProcesion}(\\d{4})$`);
            const match = t.contraseñas.match(regex);
            if (match) {
              numerosExistentes.push(parseInt(match[1], 10));
            }
          }
        }
      }

      const ultimoNumero =
        numerosExistentes.length > 0 ? Math.max(...numerosExistentes) : 0;
      const nuevoNumero = (ultimoNumero + 1).toString().padStart(4, "0");

      nuevaContraseña = `${inicialesTurno}${inicialesProcesion}${nuevoNumero}`;
    } else {
      return res.status(400).json({
        error: "Tipo de turno no reconocido. Debe ser ORDINARIO o COMISION.",
      });
    }

    if (!Array.isArray(devoto.turnos)) devoto.turnos = [];

    const indexTurno = devoto.turnos.findIndex(
      (t) => t.turnoId.toString() === turno._id.toString()
    );

    let montoTotal = 0;
    let montoPagado = 0;

    if (turno.tipoTurno === "ORDINARIO") {
      montoTotal = turno.precio || 0;
      montoPagado = turno.precio || 0;
      estadoPago = 'PAGADO'
    }else if(turno.tipoTurno === "COMISION"){
      montoPagado = turno.precio || 0;
      montoTotal = turno.precio || 0
    }

    if (indexTurno !== -1) {
      devoto.turnos.push({
        turnoId: turno._id,
        contraseñas: nuevaContraseña,
        montoPagado
      });
    } else {
      devoto.turnos.push({
        turnoId: turno._id,
        contraseñas: nuevaContraseña,
        estadoPago: "PAGADO",
        montoPagado
      });
    }

    await devoto.save();

    const compra = new Compra({
      noFactura: numeroFactura,
      devoto: devotoId,
      turno: turnoId,
      usuario: usuarioId,
      contraseña: nuevaContraseña,
      montoTotal,
      montoPagado,
      estadoPago: 'PAGADO'
    });

    await compra.save();

    res.status(201).json({
      compra,
      turno,
      mensaje:
        "Compra creada correctamente con número de factura y contraseña generada.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const listFacturas = async (req, res) => {
  try {
    const facturas = await Compra.find({ state: true })
      .populate("devoto", "nombre apellido DPI email turnos")
      .populate("turno", "noTurno marcha")
      .populate("usuario", "nombre email");

    res.status(200).json({
      message: "Listado de facturas obtenido correctamente",
      facturas,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al obtener las facturas",
      error: error.message,
    });
  }
};

export const getFacturaById = async (req, res) => {
  try {
    const { id } = req.params;

    const factura = await Compra.findById(id)
      .populate({
        path: "devoto",
        select: "nombre apellido DPI email telefono turnos",
        populate: {
          path: "turnos.turnoId",
          select: "noTurno marcha precio procesion",
          populate: {
            path: "procesion",
            select: "nombre fecha descripcion",
          },
        },
      })
      .populate({
        path: "turno",
        select: "noTurno marcha precio procesion",
        populate: {
          path: "procesion",
          select: "nombre fecha",
        },
      })
      .populate("usuario", "nombre email");

    if (!factura || !factura.state) {
      return res.status(404).json({ message: "Factura no encontrada" });
    }

    const contraseñaAsociada = factura.devoto?.turnos?.find(
      (t) => t.turnoId?._id?.toString() === factura.turno?._id?.toString()
    )?.contraseñas || "Sin contraseña";

    // Estructurar los datos de respuesta
    const response = {
      message: "Factura obtenida correctamente",
      factura: {
        ...factura.toObject(),
        contraseñaAsociada,
        detallesTurno: {
          noTurno: factura.turno?.noTurno || "N/A",
          marcha: factura.turno?.marcha || "N/A",
          precio: factura.turno?.precio || 0,
          procesion: factura.turno?.procesion || null,
        },
        detallesDevoto: {
          nombre: factura.devoto?.nombre || "N/A",
          apellido: factura.devoto?.apellido || "N/A",
          DPI: factura.devoto?.DPI || "N/A",
          email: factura.devoto?.email || "N/A",
          telefono: factura.devoto?.telefono || "N/A",
          turnos:
            factura.devoto?.turnos?.map((t) => ({
              noTurno: t.turnoId?.noTurno || "N/A",
              marcha: t.turnoId?.marcha || "N/A",
              estadoPago: t.estadoPago || "NO_PAGADO",
              contraseña: t.contraseñas || "Sin contraseña",
              procesion: t.turnoId?.procesion || null,
            })) || [],
        },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error en getFacturaById:", error);
    res.status(500).json({
      message: "Error al obtener la factura",
      error: error.message,
    });
  }
};


// Editar factura (puedes actualizar sólo ciertos campos)
export const editarFactura = async (req, res) => {
  try {
    const { id } = req.params;
    // Ejemplo de campos que podrías actualizar (ajusta según necesidades)
    const { noFactura, fechaFactura, state } = req.body;

    const factura = await Compra.findById(id);
    if (!factura || !factura.state) {
      return res.status(404).json({ message: "Factura no encontrada" });
    }

    if (noFactura !== undefined) factura.noFactura = noFactura;
    if (fechaFactura !== undefined) factura.fechaFactura = fechaFactura;
    if (state !== undefined) factura.state = state;

    await factura.save();

    res.status(200).json({
      message: "Factura actualizada correctamente",
      factura,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al actualizar la factura",
      error: error.message,
    });
  }
};

// Eliminar factura (soft delete: cambia estado a false)
export const eliminarFactura = async (req, res) => {
  try {
    const { id } = req.params;

    const factura = await Compra.findById(id);
    if (!factura || !factura.state) {
      return res.status(404).json({ message: "Factura no encontrada" });
    }

    factura.state = false;
    await factura.save();

    res.status(200).json({
      message: "Factura eliminada correctamente",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error al eliminar la factura",
      error: error.message,
    });
  }
};

export const historialVentasPorUsuario = async (req, res) => {
  try {
    const { id } = req.params; 

    const historial = await Compra.find({
      usuario: id,
      state: true,
    })
      .populate({
        path: "devoto",
        select: "nombre apellido DPI email",
      })
      .populate({
        path: "turno",
        select: "noTurno marcha precio procesion tipoTurno",
        populate: {
          path: "procesion",
          select: "nombre fecha",
        },
      })
      .sort({ fechaFactura: -1 }); 

    if (!historial || historial.length === 0) {
      return res.status(404).json({
        message: "No se encontraron ventas para este usuario",
      });
    }

    const respuesta = historial.map((compra) => {
      const { uid, noFactura, fechaFactura, devoto, turno, tipoReserva, estadoPago, montoTotal, montoPagado } = compra;

      return {
        uid,
        noFactura,
        fechaFactura: fechaFactura, // formato legible
        devoto: devoto ? `${devoto.nombre} ${devoto.apellido}` : "N/A",
        dpi: devoto?.DPI || "N/A",
        email: devoto?.email || "N/A",
        turno: turno?.noTurno || "N/A",
        tipoTurno: turno?.tipoTurno || "N/A",
        precio: turno?.precio || 0,
        procesion: turno?.procesion?.nombre || "N/A",
        fechaProcesion: turno?.procesion?.fecha ? new Date(turno.procesion.fecha).toLocaleDateString() : "N/A",
        tipoReserva: tipoReserva || "N/A",
        estadoPago: estadoPago || "NO_PAGADO",
        montoTotal: montoTotal || 0,
        montoPagado: montoPagado || 0,
        saldoPendiente: (montoTotal || 0) - (montoPagado || 0),
      };
    });

    res.status(200).json({
      message: "Historial de ventas obtenido correctamente",
      historial: respuesta,
    });
  } catch (error) {
    console.error("Error en historialVentasPorUsuario:", error);
    res.status(500).json({
      message: "Error al obtener historial de ventas",
      error: error.message,
    });
  }
};

export const pagarComision = async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    const { devotoId, turnoId, montoPagado } = req.body;

    if (!usuarioId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    if (montoPagado <= 0) {
      return res.status(400).json({ error: "El monto debe ser mayor a cero" });
    }

    // Buscar devoto y turno
    const devoto = await Devoto.findById(devotoId).populate({
      path: "turnos.turnoId",
      populate: { path: "procesion" }
    });
    if (!devoto) return res.status(404).json({ error: "Devoto no encontrado" });

    const turno = await Turno.findById(turnoId).populate("procesion");
    if (!turno) return res.status(404).json({ error: "Turno no encontrado" });

    // Buscar turno específico del devoto
    const turnoDevoto = devoto.turnos.find(t => t.turnoId && t.turnoId._id.toString() === turnoId);
    if (!turnoDevoto) {
      return res.status(404).json({ error: "El devoto no tiene asignado este turno" });
    }

    // Buscar o crear compra asociada
    let compra = await Compra.findOne({ devoto: devotoId, turno: turnoId });
    if (!compra) {
      compra = new Compra({
        devoto: devotoId,
        turno: turnoId,
        usuario: usuarioId,
        tipoReserva: turno.tipoTurno === "COMISION" ? "MEDIO" : "COMPLETO",
        montoTotal: turno.precio,
        montoPagado: 0,
        estadoPago: "NO_PAGADO"
      });
    }

    // === Generar número de factura ===
    const procesion = turno.procesion;
    const totalComprasProcesion = await Compra.countDocuments({
      turno: { $in: await Turno.find({ procesion: procesion._id }).distinct("_id") }
    });

    const inicialesProcesion = procesion.nombre
      .split(" ")
      .map(w => w[0])
      .join("")
      .toUpperCase();

    const numeroFactura = `FAC${inicialesProcesion}${(totalComprasProcesion + 1)
      .toString()
      .padStart(4, "0")}`;

    compra.noFactura = numeroFactura;

    // Calcular nuevos montos
    const montoAcumulado = (turnoDevoto.montoPagado || 0) + montoPagado;
    const saldoPendiente = turno.precio - montoAcumulado;

    if (montoAcumulado > turno.precio) {
      return res.status(400).json({ 
        error: `El monto excede el precio total. Máximo a pagar: ${saldoPendiente + montoPagado}` 
      });
    }

    // Determinar estado de pago
    let nuevoEstadoPago = "NO_PAGADO";
    if (montoAcumulado >= turno.precio) {
      nuevoEstadoPago = "PAGADO";
    } else if (turno.tipoTurno === "COMISION" && montoAcumulado >= (turno.precio / 2)) {
      nuevoEstadoPago = "MITAD";
    } else {
      nuevoEstadoPago = "MITAD";
    }

    // Actualizar devoto
    turnoDevoto.montoPagado = montoAcumulado;
    turnoDevoto.estadoPago = nuevoEstadoPago;
    turnoDevoto.ultimoPago = { fecha: new Date(), monto: montoPagado, usuario: usuarioId };
    await devoto.save();

    // Actualizar compra
    compra.montoPagado = montoAcumulado;
    compra.estadoPago = nuevoEstadoPago;
    compra.pagos.push({ fecha: new Date(), monto: montoPagado, usuario: usuarioId });
    await compra.save();

    res.status(200).json({
      success: true,
      mensaje: `Pago registrado exitosamente`,
      devoto: {
        nombre: devoto.nombre,
        apellido: devoto.apellido,
        turnos: devoto.turnos.map(t => ({
          turnoId: t.turnoId,
          estadoPago: t.estadoPago,
          montoPagado: t.montoPagado || 0,
          saldoPendiente: turno.precio - (t.montoPagado || 0),
          contraseñas: t.contraseñas
        }))
      },
      turno: {
        noTurno: turno.noTurno,
        tipoTurno: turno.tipoTurno,
        precio: turno.precio,
        procesion: turno.procesion
      },
      compraId: compra._id,
      noFactura: compra.noFactura,
      montoPagado,
      montoAcumulado,
      saldoPendiente
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
};

export const pagarOrdinario = async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    const { devotoId, turnoId, contraseña } = req.body;

    if (!usuarioId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    if (!contraseña || typeof contraseña !== "string" || contraseña.trim() === "") {
      return res.status(400).json({ error: "Debe proporcionar una contraseña válida" });
    }

    const devoto = await Devoto.findById(devotoId);
    if (!devoto) return res.status(404).json({ error: "Devoto no encontrado" });

    const turno = await Turno.findById(turnoId);
    if (!turno) return res.status(404).json({ error: "Turno no encontrado" });

    if (turno.tipoTurno !== "ORDINARIO") {
      return res.status(400).json({ error: "Este pago es solo para turnos ORDINARIO" });
    }

    // Verificar disponibilidad
    if (turno.cantidadSinVender <= 0) {
      return res.status(400).json({ error: "No hay turnos disponibles para vender" });
    }

    // ===== Descontar =====
    turno.cantidadSinVender -= 1;
    turno.cantidadVendida  += 1;
    await turno.save();

    // ===== Buscar turno por contraseña =====
    let turnoDevoto = devoto.turnos.find(t => t.contraseñas === contraseña);

    if (turnoDevoto) {
      // ✔ Existe una contraseña igual → solo actualizo turnoId y datos de pago
      turnoDevoto.turnoId     = turno._id;
      turnoDevoto.estadoPago  = "PAGADO";
      turnoDevoto.montoPagado = turno.precio;
      turnoDevoto.ultimoPago  = {
        fecha: new Date(),
        monto: turno.precio,
        usuario: usuarioId
      };
    } else {
      // ❌ No existe esa contraseña → agregamos uno nuevo
      devoto.turnos.push({
        turnoId: turno._id,
        contraseñas: contraseña,
        estadoPago: "PAGADO",
        montoPagado: turno.precio,
        ultimoPago: {
          fecha: new Date(),
          monto: turno.precio,
          usuario: usuarioId
        }
      });
    }

    await devoto.save();

    // ===== Generar factura y crear compra =====
    const procesion = await Procesion.findById(turno.procesion);
    const totalComprasProcesion = await Compra.countDocuments({
      turno: { $in: await Turno.find({ procesion: procesion._id }).distinct("_id") }
    });

    const inicialesProcesion = procesion.nombre.split(" ").map(w => w[0]).join("").toUpperCase();
    const numeroFactura      = `FAC${inicialesProcesion}${(totalComprasProcesion + 1)
      .toString()
      .padStart(4, "0")}`;

    const compra = new Compra({
      noFactura:    numeroFactura,
      devoto:       devotoId,
      turno:        turnoId,
      usuario:      usuarioId,
      contraseña:   contraseña,
      montoTotal:   turno.precio,
      montoPagado:  turno.precio,
      estadoPago:   "PAGADO",
      pagos: [
        { fecha: new Date(), monto: turno.precio, usuario: usuarioId }
      ]
    });

    await compra.save();

    res.status(201).json({
      success: true,
      mensaje: "Pago de turno ordinario registrado correctamente",
      compra,
      devoto,
      turno
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
};


export const reservarTurno = async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    const { devotoId, turnoId, tipoReserva } = req.body;

    // 1️⃣ Validar tipo de reserva
    if (!["COMPLETO", "MEDIO"].includes(tipoReserva)) {
      return res.status(400).json({ error: "Tipo de reserva inválido" });
    }

    // 2️⃣ Buscar datos
    const turno = await Turno.findById(turnoId).populate("procesion");
    if (!turno) return res.status(404).json({ error: "Turno no encontrado" });

    const devoto = await Devoto.findById(devotoId);
    if (!devoto) return res.status(404).json({ error: "Devoto no encontrado" });

    // 3️⃣ Validar disponibilidad
    const cantidadNecesaria = tipoReserva === "COMPLETO" ? turno.cantidad : turno.cantidad / 2;
    if (turno.cantidadSinVender < cantidadNecesaria) {
      return res.status(400).json({ error: "No hay suficiente cantidad de turnos para reservar" });
    }

    // 4️⃣ Generar contraseña con iniciales de cada palabra de la procesión + primer nombre
    const inicialesProcesion = turno.procesion.nombre
      .split(" ")
      .map(word => word[0].toUpperCase())
      .join("");
    const primerNombre = devoto.nombre.split(" ")[0].toUpperCase();
    const contraseña = `${inicialesProcesion}${primerNombre}`;

    // 5️⃣ Generar número de factura
    const consecutivo = (await Compra.countDocuments()) + 1;
    const noFactura = `FAC${inicialesProcesion}${String(consecutivo).padStart(5, "0")}`;

    // 6️⃣ Calcular monto a pagar
    const montoPagar = (tipoReserva === "COMPLETO" ? turno.cantidad : turno.cantidad / 2) * turno.precio;

    // 7️⃣ Crear registro de compra
    const compra = new Compra({
      noFactura,
      devoto: devotoId,
      turno: turnoId,
      usuario: usuarioId,
      contraseña: contraseña,
      tipoReserva,
      montoTotal: montoPagar,
      montoPagado: montoPagar,
      estadoPago: "PAGADO"
    });

    // 8️⃣ Agregar turno al devoto
    devoto.turnos.push({
      turnoId: turno._id,
      contraseñas: contraseña,
      estadoPago: "PAGADO",
      montoPagado: montoPagar
    });

    // 9️⃣ Actualizar disponibilidad del turno
    turno.cantidadSinVender -= cantidadNecesaria;
    turno.cantidadVendida = cantidadNecesaria

    await Promise.all([compra.save(), devoto.save(), turno.save()]);

    res.status(201).json({
      success: true,
      compra,
      devoto,
      message: `Turno reservado como ${tipoReserva}. Monto total: Q${montoPagar}`
    });

  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const registrarPago = async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    const { compraId, monto } = req.body;

    const compra = await Compra.findById(compraId);
    if (!compra) return res.status(404).json({ error: "Compra no encontrada" });

    const devoto = await Devoto.findById(compra.devoto);
    if (!devoto) return res.status(404).json({ error: "Devoto no encontrado" });

    // Encontrar el turno en el devoto
    const turnoDevoto = devoto.turnos.find(t => t.turnoId.toString() === compra.turno.toString());
    if (!turnoDevoto) {
      return res.status(404).json({ error: "Turno no encontrado en el devoto" });
    }

    // Actualizar montos
    const nuevoMontoPagado = compra.montoPagado + monto;
    const saldoPendiente = compra.montoTotal - nuevoMontoPagado;

    // Validar que no se pague más del total
    if (nuevoMontoPagado > compra.montoTotal) {
      return res.status(400).json({ 
        error: `El monto excede el total. Saldo pendiente: ${compra.montoTotal - compra.montoPagado}` 
      });
    }

    // Determinar estado del pago
    let nuevoEstado = "NO_PAGADO";
    if (nuevoMontoPagado >= compra.montoTotal) {
      nuevoEstado = "PAGADO";
    } else if (nuevoMontoPagado >= (compra.montoTotal / 2)) {
      nuevoEstado = "MITAD";
    }

    // Actualizar compra
    compra.montoPagado = nuevoMontoPagado;
    compra.estadoPago = nuevoEstado;
    compra.pagos.push({
      monto,
      usuario: usuarioId
    });

    // Actualizar devoto
    turnoDevoto.montoPagado = nuevoMontoPagado;
    turnoDevoto.estadoPago = nuevoEstado;
    turnoDevoto.ultimoPago = {
      fecha: new Date(),
      monto,
      usuario: usuarioId
    };

    await Promise.all([compra.save(), devoto.save()]);

    res.status(200).json({
      success: true,
      compra,
      devoto,
      saldoPendiente,
      message: `Pago registrado. Estado actual: ${nuevoEstado}`
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const generarFacturaPDF = async (req, res) => {
  try {
    const { noFactura } = req.params;

    // Validación básica del parámetro
    if (!noFactura || typeof noFactura !== 'string') {
      return res.status(400).json({ error: "Número de factura inválido" });
    }

    // Buscar la factura con todas las relaciones necesarias
    const factura = await Compra.findOne({ noFactura })
      .populate('devoto')
      .populate({
        path: 'turno',
        populate: { path: 'procesion' }
      })
      .populate('usuario');

    // Validar que la factura existe
    if (!factura) {
      return res.status(404).json({ error: "Factura no encontrada" });
    }

    // Validar datos requeridos
    if (!factura.devoto || !factura.turno || !factura.usuario) {
      return res.status(400).json({ error: "Datos incompletos en la factura" });
    }

    // Manejo seguro del filtrado de turnos
    const turnosFiltrados = factura.devoto?.turnos?.filter(t => {
      try {
        // Verificar que tanto t.turnoId como factura.turno._id existan
        return t?.turnoId?.toString() === factura.turno?._id?.toString();
      } catch (error) {
        console.error('Error al comparar turnos:', error);
        return false;
      }
    }) || [];

    // Obtener contraseña de forma segura
    const contraseña = turnosFiltrados.length > 0 
      ? turnosFiltrados[turnosFiltrados.length - 1]?.contraseñas || ''
      : '';

    // Crear documento PDF
    const doc = new PDFDocument({
      size: [612, 396], // Tamaño carta en puntos (8.5x11 pulgadas)
      margin: 40,
      layout: 'portrait',
    });

    // Configurar headers de respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Recibo_${noFactura}.pdf`);

    // Conectar el stream del PDF al response
    doc.pipe(res);

    // Manejar errores en el stream
    doc.on('error', (err) => {
      console.error('Error en PDF stream:', err);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    // Colores del diseño
    const darkGray = '#403f3f';
    const mediumGray = '#6b6a6a';
    const lightGray = '#f5f5f5';

    // Fondo blanco
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

    // Logo - Manejo seguro
    try {
      const rutaLogo = path.join(__dirname, 'logo_hermandad.png');
      if (fs.existsSync(rutaLogo)) {
        doc.image(rutaLogo, 40, 30, { width: 45, height: 45 });
      } else {
        console.warn('Logo no encontrado en:', rutaLogo);
      }
    } catch (imageError) {
      console.error('Error al cargar imagen:', imageError);
    }

    // Nombre procesión - Manejo seguro
    const nombreProcesion = factura.turno?.procesion?.nombre?.toUpperCase() || 'PROCESIÓN NO ESPECIFICADA';
    doc.fillColor(darkGray)
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(nombreProcesion, 90, 40);

    // Línea divisoria
    doc.moveTo(40, 85)
      .lineTo(doc.page.width - 40, 85)
      .lineWidth(1)
      .strokeColor(lightGray)
      .stroke();

    // Datos básicos - Manejo seguro de fechas
    const infoY = 95;
    const fechaFactura = factura.createdAt ? new Date(factura.createdAt) : new Date();
    
    doc.fillColor(mediumGray)
      .font('Helvetica')
      .fontSize(9)
      .text('NÚMERO:', 40, infoY)
      .text('FECHA:', 180, infoY)
      .text('HORA:', 330, infoY);

    doc.fillColor(darkGray)
      .font('Helvetica-Bold')
      .text(factura.noFactura || 'N/A', 40, infoY + 15)
      .text(fechaFactura.toLocaleDateString('es-GT'), 180, infoY + 15)
      .text(fechaFactura.toLocaleTimeString('es-GT', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }), 330, infoY + 15);

    // Sección Devoto - Manejo seguro
    const devotoY = infoY + 50;
    doc.rect(40, devotoY - 10, doc.page.width - 80, 45).fill(lightGray);

    doc.fillColor(mediumGray)
      .font('Helvetica')
      .fontSize(9)
      .text('DEVOTO', 45, devotoY - 5);

    const nombreCompleto = `${factura.devoto?.nombre || ''} ${factura.devoto?.apellido || ''}`.trim();
    doc.fillColor(darkGray)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(nombreCompleto || 'Nombre no disponible', 45, devotoY + 10);

    // Detalles de pago
    const detailsY = devotoY + 55;
    const colWidth = (doc.page.width - 80) / 3;

    doc.fillColor(mediumGray)
      .font('Helvetica')
      .fontSize(9)
      .text('CONTRASEÑA', 40, detailsY)
      .text('TURNO', 40 + colWidth, detailsY)
      .text('MONTO', 40 + colWidth * 2, detailsY, { align: 'right' });

    doc.moveTo(40, detailsY + 15)
      .lineTo(doc.page.width - 40, detailsY + 15)
      .lineWidth(0.5)
      .strokeColor(lightGray)
      .stroke();

    doc.fillColor(darkGray)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(contraseña, 40, detailsY + 25)
      .text(factura.turno?.noTurno || 'N/A', 40 + colWidth, detailsY + 25)
      .text(`Q. ${factura.montoPagado?.toFixed(2) || '0.00'}`, 40 + colWidth * 2, detailsY + 25, { align: 'right' });

    // Vendedor - Manejo seguro
    const sellerY = detailsY + 60;
    doc.fillColor(mediumGray)
      .font('Helvetica')
      .fontSize(8)
      .text('ATENDIDO POR:', 40, sellerY);

    doc.fillColor(darkGray)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(factura.usuario?.nombre || 'Vendedor no especificado', 40, sellerY + 15);

    // Frase al final
    const footerY = doc.page.height - 65;
    doc.fillColor(mediumGray)
      .font('Times-Italic')
      .fontSize(11)
      .text('«Si conociéramos el valor de la Santa Misa, ¡qué gran esfuerzo haríamos por asistir a ella!»', 
        40, footerY, {
          width: doc.page.width - 80,
          align: 'center',
        });

    doc.font('Times-Roman')
      .fontSize(9)
      .text('– San Juan María Vianney', {
        align: 'center',
      });

    // Finalizar documento
    doc.end();

  } catch (error) {
    console.error('Error al generar factura PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Error al generar el recibo en PDF",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};
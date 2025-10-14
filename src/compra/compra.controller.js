import Compra from "./compra.model.js";
import Devoto from "../devoto/devoto.model.js";
import Turno from "../turno/turno.model.js";
import Procesion from "../procesion/procesion.model.js";
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import blobStream from "blob-stream";
import { fileURLToPath } from "url";
import sgMail from "@sendgrid/mail";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

    // Verificar disponibilidad
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

    // === Generar contraseña asociada ===
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

      const nuevoNumero = (totalComprasOrdinario + 1)
        .toString()
        .padStart(4, "0");
      nuevaContraseña = `OR${inicialesProcesion}${nuevoNumero}`;
    } else if (turno.tipoTurno === "COMISION") {
      const inicialesTurno = turno.noTurno
        .toString()
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase();

      const palabrasProcesion = procesion.nombre.trim().split(/\s+/);
      const inicialesProcesion = palabrasProcesion
        .map((w) => w.substring(0, 1).toUpperCase())
        .slice(0, 3)
        .join("");

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
          if (
            t?.turnoId?.toString() === turno._id.toString() &&
            typeof t?.contraseñas === "string"
          ) {
            const regex = new RegExp(
              `^${inicialesTurno}${inicialesProcesion}(\\d{3})$`
            );
            const match = t.contraseñas.match(regex);
            if (match) {
              numerosExistentes.push(parseInt(match[1], 10));
            }
          }
        }
      }

      let nuevoNumero = 1;
      if (numerosExistentes.length > 0) {
        numerosExistentes.sort((a, b) => a - b);
        nuevoNumero = 1;
        for (let i = 0; i < numerosExistentes.length; i++) {
          if (numerosExistentes[i] !== i + 1) {
            nuevoNumero = i + 1;
            break;
          }
        }
        if (
          nuevoNumero <= numerosExistentes.length &&
          numerosExistentes.includes(nuevoNumero)
        ) {
          nuevoNumero = numerosExistentes[numerosExistentes.length - 1] + 1;
        }
      }

      const numeroFormateado = nuevoNumero.toString().padStart(3, "0");

      nuevaContraseña = `${inicialesTurno}${inicialesProcesion}${numeroFormateado}`;
    } else {
      return res.status(400).json({
        error: "Tipo de turno no reconocido. Debe ser ORDINARIO o COMISION.",
      });
    }

    if (!Array.isArray(devoto.turnos)) devoto.turnos = [];

    devoto.turnos.push({
      turnoId: turno._id,
      contraseñas: nuevaContraseña,
      estadoPago: "PAGADO",
      montoPagado: turno.precio || 0,
    });

    await devoto.save();

    const compra = new Compra({
      noFactura: numeroFactura,
      devoto: devotoId,
      turno: turnoId,
      usuario: usuarioId,
      contraseña: nuevaContraseña,
      montoTotal: turno.precio || 0,
      montoPagado: turno.precio || 0,
      estadoPago: "PAGADO",
    });

    await compra.save();

    const htmlFactura = `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border:1px solid #ddd; padding:20px; border-radius:8px; background-color:#f9f9f9;">
    
    <!-- Logo -->
    <div style="text-align:center; margin-bottom:20px;">
      <img src="https://i.imgur.com/z8QVtm9.png" alt="Logo Hermandad" style="width:100px; height:auto;">
    </div>

    <!-- Encabezado principal -->
    <h1 style="color: #403f3f; text-align:center; margin-bottom:5px;">Pago de Turno - ${
      procesion.nombre
    }</h1>
    <h3 style="color:#59818B; text-align:center; margin-top:0; font-weight:normal;">
      Hermandad de Jesús Nazareno Redentor de los Cautivos y Virgen de Dolores <br/>
      Parroquia Santa Marta
    </h3>
    <hr style="border:1px solid #86AFB9; margin:20px 0;"/>

    <!-- Datos de la factura -->
    <div style="background-color:#f5f5f5; padding:15px; border-radius:5px; margin-bottom:20px;">
      <p><strong>Número de Factura:</strong> ${numeroFactura}</p>
      <p><strong>Devoto:</strong> ${devoto.nombre} ${devoto.apellido}</p>
      <p><strong>Turno:</strong> ${turno.noTurno}</p>
      <p><strong>Contraseña:</strong> ${nuevaContraseña}</p>
      <p><strong>Monto Pagado:</strong> Q. ${(turno.precio || 0).toFixed(2)}</p>
    </div>

    <!-- Frase inspiradora -->
    <blockquote style="font-style: italic; color:#6b6a6a; text-align:center; margin:30px 0;">
      «Si conociéramos el valor de la Santa Misa, ¡qué gran esfuerzo haríamos por asistir a ella!»
    </blockquote>
    <p style="text-align:center; font-size:12px; margin-top:0;">– San Juan María Vianney</p>

    <!-- Pie de página -->
    <hr style="border:1px solid #86AFB9; margin:20px 0;"/>
    <p style="text-align:center; font-size:12px; color:#6b6a6a;">
      Este es un comprobante electrónico de pago. Guárdelo para su registro.
    </p>
  </div>
    `;
    if (devoto.email) {
      await sgMail.send({
        to: devoto.email,
        from: "hermandadsantamartazona3@gmail.com",
        subject: `Pago de Turno - ${procesion.nombre}`,
        html: htmlFactura,
      });
    }

    res.status(201).json({
      compra,
      turno,
      mensaje: "Compra creada y factura enviada al correo del devoto.",
    });
  } catch (error) {
    console.error(
      "Error al enviar correo:",
      error.response?.body || error.message || error
    );
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

    const contraseñaAsociada =
      factura.devoto?.turnos?.find(
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

export const editarFactura = async (req, res) => {
  try {
    const { id } = req.params;
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
      const {
        uid,
        noFactura,
        fechaFactura,
        devoto,
        turno,
        tipoReserva,
        estadoPago,
        montoTotal,
        montoPagado,
      } = compra;

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
        fechaProcesion: turno?.procesion?.fecha
          ? new Date(turno.procesion.fecha).toLocaleDateString()
          : "N/A",
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

export const ventasPorProcesion = async (req, res) => {
  try {
    const { procesionId } = req.params;

    if (!procesionId) {
      return res.status(400).json({
        message: "Debe proporcionar el ID de la procesión",
      });
    }

    const turnos = await Turno.find({ procesion: procesionId }).select("_id");

    if (!turnos || turnos.length === 0) {
      return res.status(404).json({
        message: "No se encontraron turnos asociados a esta procesión",
      });
    }

    const turnosIds = turnos.map((t) => t._id);

    const facturas = await Compra.find({
      turno: { $in: turnosIds },
      state: true,
    })
      .populate({
        path: "devoto",
        select: "nombre apellido DPI",
      })
      .populate({
        path: "turno",
        select: "noTurno tipoTurno precio",
      })
      .sort({ fechaFactura: -1 });

    if (!facturas || facturas.length === 0) {
      return res.status(404).json({
        message: "No se encontraron facturas para esta procesión",
      });
    }

    const totalVendido = facturas.reduce(
      (acc, f) => acc + (f.montoTotal || 0),
      0
    );

    const detalleFacturas = facturas.map((f) => ({
      noFactura: f.noFactura,
      fechaFactura: f.fechaFactura,
      devoto: f.devoto ? `${f.devoto.nombre} ${f.devoto.apellido}` : "N/A",
      dpi: f.devoto?.DPI || "N/A",
      turno: f.turno?.noTurno || "N/A",
      tipoTurno: f.turno?.tipoTurno || "N/A",
      precio: f.turno?.precio || 0,
      estadoPago: f.estadoPago,
      montoTotal: f.montoTotal || 0,
      montoPagado: f.montoPagado || 0,
    }));

    res.status(200).json({
      message: "Ventas por procesión obtenidas correctamente",
      procesionId,
      totalFacturas: facturas.length,
      totalVendido,
      facturas: detalleFacturas,
    });
  } catch (error) {
    console.error("Error en ventasPorProcesion:", error);
    res.status(500).json({
      message: "Error al obtener las ventas por procesión",
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
      populate: { path: "procesion" },
    });
    if (!devoto) return res.status(404).json({ error: "Devoto no encontrado" });

    const turno = await Turno.findById(turnoId).populate("procesion");
    if (!turno) return res.status(404).json({ error: "Turno no encontrado" });

    // Buscar turno específico del devoto
    const turnoDevoto = devoto.turnos.find(
      (t) => t.turnoId && t.turnoId._id.toString() === turnoId
    );
    if (!turnoDevoto) {
      return res
        .status(404)
        .json({ error: "El devoto no tiene asignado este turno" });
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
        estadoPago: "NO_PAGADO",
      });
    }

    // === Generar número de factura ===
    const procesion = turno.procesion;
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

    compra.noFactura = numeroFactura;

    // Calcular nuevos montos
    const montoAcumulado = (turnoDevoto.montoPagado || 0) + montoPagado;
    const saldoPendiente = turno.precio - montoAcumulado;

    if (montoAcumulado > turno.precio) {
      return res.status(400).json({
        error: `El monto excede el precio total. Máximo a pagar: ${
          saldoPendiente + montoPagado
        }`,
      });
    }

    // Determinar estado de pago
    let nuevoEstadoPago = "NO_PAGADO";
    if (montoAcumulado >= turno.precio) {
      nuevoEstadoPago = "PAGADO";
    } else if (
      turno.tipoTurno === "COMISION" &&
      montoAcumulado >= turno.precio / 2
    ) {
      nuevoEstadoPago = "MITAD";
    } else {
      nuevoEstadoPago = "MITAD";
    }

    // Actualizar devoto
    turnoDevoto.montoPagado = montoAcumulado;
    turnoDevoto.estadoPago = nuevoEstadoPago;
    turnoDevoto.ultimoPago = {
      fecha: new Date(),
      monto: montoPagado,
      usuario: usuarioId,
    };
    await devoto.save();

    // Actualizar compra
    compra.montoPagado = montoAcumulado;
    compra.estadoPago = nuevoEstadoPago;
    compra.pagos.push({
      fecha: new Date(),
      monto: montoPagado,
      usuario: usuarioId,
    });
    await compra.save();

    const htmlFactura = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border:1px solid #ddd; padding:20px; border-radius:8px; background-color:#f9f9f9;">
        
        <!-- Logo -->
        <div style="text-align:center; margin-bottom:20px;">
          <img src="https://imgur.com/a/Z2qC84U" alt="Logo Hermandad" style="width:100px; height:auto;">
        </div>

        <!-- Encabezado principal -->
        <h1 style="color: #403f3f; text-align:center; margin-bottom:5px;">Pago de Turno - ${
          procesion.nombre
        }</h1>
        <h3 style="color:#59818B; text-align:center; margin-top:0; font-weight:normal;">
          Hermandad de Jesús Nazareno Redentor de los Cautivos y Virgen de Dolores <br/>
          Parroquia Santa Marta
        </h3>
        <hr style="border:1px solid #86AFB9; margin:20px 0;"/>

        <!-- Datos de la factura -->
        <div style="background-color:#f5f5f5; padding:15px; border-radius:5px; margin-bottom:20px;">
          <p><strong>Número de Factura:</strong> ${numeroFactura}</p>
          <p><strong>Devoto:</strong> ${devoto.nombre} ${devoto.apellido}</p>
          <p><strong>Turno:</strong> ${turno.noTurno}</p>
          <p><strong>Contraseña:</strong> ${turnoDevoto.contraseñas}</p>
          <p><strong>Monto Pagado:</strong> Q. ${(turno.precio || 0).toFixed(
            2
          )}</p>
        </div>

        <!-- Frase inspiradora -->
        <blockquote style="font-style: italic; color:#6b6a6a; text-align:center; margin:30px 0;">
          «Si conociéramos el valor de la Santa Misa, ¡qué gran esfuerzo haríamos por asistir a ella!»
        </blockquote>
        <p style="text-align:center; font-size:12px; margin-top:0;">– San Juan María Vianney</p>

        <!-- Pie de página -->
        <hr style="border:1px solid #86AFB9; margin:20px 0;"/>
        <p style="text-align:center; font-size:12px; color:#6b6a6a;">
          Este es un comprobante electrónico de pago. Guárdelo para su registro.
        </p>
      </div>
    `;
    if (devoto.email) {
      await sgMail.send({
        to: devoto.email,
        from: "hermandadsantamartazona3@gmail.com",
        subject: `Pago de Turno - ${procesion.nombre}`,
        html: htmlFactura,
      });
    }

    res.status(200).json({
      success: true,
      mensaje: `Pago registrado exitosamente`,
      devoto: {
        nombre: devoto.nombre,
        apellido: devoto.apellido,
        turnos: devoto.turnos.map((t) => ({
          turnoId: t.turnoId,
          estadoPago: t.estadoPago,
          montoPagado: t.montoPagado || 0,
          saldoPendiente: turno.precio - (t.montoPagado || 0),
          contraseñas: t.contraseñas,
        })),
      },
      turno: {
        noTurno: turno.noTurno,
        tipoTurno: turno.tipoTurno,
        precio: turno.precio,
        procesion: turno.procesion,
      },
      compraId: compra._id,
      noFactura: compra.noFactura,
      montoPagado,
      montoAcumulado,
      saldoPendiente,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
};

export const pagarOrdinario = async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    const { devotoId, turnoId, contraseña } = req.body;

    if (!usuarioId) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    if (
      !contraseña ||
      typeof contraseña !== "string" ||
      contraseña.trim() === ""
    ) {
      return res
        .status(400)
        .json({ error: "Debe proporcionar una contraseña válida" });
    }

    const devoto = await Devoto.findById(devotoId);
    if (!devoto) return res.status(404).json({ error: "Devoto no encontrado" });

    const turno = await Turno.findById(turnoId);
    if (!turno) return res.status(404).json({ error: "Turno no encontrado" });

    if (turno.tipoTurno !== "ORDINARIO") {
      return res
        .status(400)
        .json({ error: "Este pago es solo para turnos ORDINARIO" });
    }

    // Verificar disponibilidad
    if (turno.cantidadSinVender <= 0) {
      return res
        .status(400)
        .json({ error: "No hay turnos disponibles para vender" });
    }

    // ===== Descontar =====
    turno.cantidadSinVender -= 1;
    turno.cantidadVendida += 1;
    await turno.save();

    // ===== Buscar turno por contraseña =====
    let turnoDevoto = devoto.turnos.find((t) => t.contraseñas === contraseña);

    if (turnoDevoto) {
      // ✔ Existe una contraseña igual → solo actualizo turnoId y datos de pago
      turnoDevoto.turnoId = turno._id;
      turnoDevoto.estadoPago = "PAGADO";
      turnoDevoto.montoPagado = turno.precio;
      turnoDevoto.ultimoPago = {
        fecha: new Date(),
        monto: turno.precio,
        usuario: usuarioId,
      };
    } else {
      devoto.turnos.push({
        turnoId: turno._id,
        contraseñas: contraseña,
        estadoPago: "PAGADO",
        montoPagado: turno.precio,
        ultimoPago: {
          fecha: new Date(),
          monto: turno.precio,
          usuario: usuarioId,
        },
      });
    }

    await devoto.save();

    // ===== Generar factura y crear compra =====
    const procesion = await Procesion.findById(turno.procesion);
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

    const compra = new Compra({
      noFactura: numeroFactura,
      devoto: devotoId,
      turno: turnoId,
      usuario: usuarioId,
      contraseña: contraseña,
      montoTotal: turno.precio,
      montoPagado: turno.precio,
      estadoPago: "PAGADO",
      pagos: [{ fecha: new Date(), monto: turno.precio, usuario: usuarioId }],
    });

    await compra.save();

    const htmlFactura = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border:1px solid #ddd; padding:20px; border-radius:8px; background-color:#f9f9f9;">
        
        <!-- Logo -->
        <div style="text-align:center; margin-bottom:20px;">
          <img src="https://imgur.com/a/Z2qC84U" alt="Logo Hermandad" style="width:100px; height:auto;">
        </div>

        <!-- Encabezado principal -->
        <h1 style="color: #403f3f; text-align:center; margin-bottom:5px;">Pago de Turno - ${
          procesion.nombre
        }</h1>
        <h3 style="color:#59818B; text-align:center; margin-top:0; font-weight:normal;">
          Hermandad de Jesús Nazareno Redentor de los Cautivos y Virgen de Dolores <br/>
          Parroquia Santa Marta
        </h3>
        <hr style="border:1px solid #86AFB9; margin:20px 0;"/>

        <!-- Datos de la factura -->
        <div style="background-color:#f5f5f5; padding:15px; border-radius:5px; margin-bottom:20px;">
          <p><strong>Número de Factura:</strong> ${numeroFactura}</p>
          <p><strong>Devoto:</strong> ${devoto.nombre} ${devoto.apellido}</p>
          <p><strong>Turno:</strong> ${turno.noTurno}</p>
          <p><strong>Contraseña:</strong> ${turnoDevoto.contraseñas}</p>
          <p><strong>Monto Pagado:</strong> Q. ${(turno.precio || 0).toFixed(
            2
          )}</p>
        </div>

        <!-- Frase inspiradora -->
        <blockquote style="font-style: italic; color:#6b6a6a; text-align:center; margin:30px 0;">
          «Si conociéramos el valor de la Santa Misa, ¡qué gran esfuerzo haríamos por asistir a ella!»
        </blockquote>
        <p style="text-align:center; font-size:12px; margin-top:0;">– San Juan María Vianney</p>

        <!-- Pie de página -->
        <hr style="border:1px solid #86AFB9; margin:20px 0;"/>
        <p style="text-align:center; font-size:12px; color:#6b6a6a;">
          Este es un comprobante electrónico de pago. Guárdelo para su registro.
        </p>
      </div>
    `;
    if (devoto.email) {
      await sgMail.send({
        to: devoto.email,
        from: "hermandadsantamartazona3@gmail.com",
        subject: `Pago de Turno - ${procesion.nombre}`,
        html: htmlFactura,
      });
    }

    res.status(201).json({
      success: true,
      mensaje: "Pago de turno ordinario registrado correctamente",
      compra,
      devoto,
      turno,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Error interno del servidor", details: error.message });
  }
};

export const reservarTurno = async (req, res) => {
  try {
    const usuarioId = req.usuario._id;
    const { devotoId, turnoId, tipoReserva } = req.body;
    if (!["COMPLETO", "MEDIO"].includes(tipoReserva)) {
      return res.status(400).json({ error: "Tipo de reserva inválido" });
    }
    const turno = await Turno.findById(turnoId).populate("procesion");
    if (!turno) return res.status(404).json({ error: "Turno no encontrado" });

    const devoto = await Devoto.findById(devotoId);
    if (!devoto) return res.status(404).json({ error: "Devoto no encontrado" });
    const cantidadNecesaria =
      tipoReserva === "COMPLETO" ? turno.cantidad : turno.cantidad / 2;
    if (turno.cantidadSinVender < cantidadNecesaria) {
      return res
        .status(400)
        .json({ error: "No hay suficiente cantidad de turnos para reservar" });
    }
    const inicialesProcesion = turno.procesion.nombre
      .split(" ")
      .map((word) => word[0].toUpperCase())
      .join("");
    const primerNombre = devoto.nombre.split(" ")[0].toUpperCase();
    const contraseña = `${inicialesProcesion}${primerNombre}`;
    const consecutivo = (await Compra.countDocuments()) + 1;
    const noFactura = `FAC${inicialesProcesion}${String(consecutivo).padStart(
      5,
      "0"
    )}`;
    const montoPagar =
      (tipoReserva === "COMPLETO" ? turno.cantidad : turno.cantidad / 2) *
      turno.precio;
    const compra = new Compra({
      noFactura,
      devoto: devotoId,
      turno: turnoId,
      usuario: usuarioId,
      contraseña: contraseña,
      tipoReserva,
      montoTotal: montoPagar,
      montoPagado: montoPagar,
      estadoPago: "PAGADO",
    });
    devoto.turnos.push({
      turnoId: turno._id,
      contraseñas: contraseña,
      estadoPago: "PAGADO",
      montoPagado: montoPagar,
    });
    turno.cantidadSinVender -= cantidadNecesaria;
    turno.cantidadVendida = cantidadNecesaria;

    await Promise.all([compra.save(), devoto.save(), turno.save()]);

    const htmlFactura = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border:1px solid #ddd; padding:20px; border-radius:8px; background-color:#f9f9f9;">
        
        <!-- Logo -->
        <div style="text-align:center; margin-bottom:20px;">
          <img src="https://imgur.com/a/Z2qC84U" alt="Logo Hermandad" style="width:100px; height:auto;">
        </div>

        <!-- Encabezado principal -->
        <h1 style="color: #403f3f; text-align:center; margin-bottom:5px;">Pago de Turno - ${
          turno.procesion.nombre
        }</h1>
        <h3 style="color:#59818B; text-align:center; margin-top:0; font-weight:normal;">
          Hermandad de Jesús Nazareno Redentor de los Cautivos y Virgen de Dolores <br/>
          Parroquia Santa Marta
        </h3>
        <hr style="border:1px solid #86AFB9; margin:20px 0;"/>

        <!-- Datos de la factura -->
        <div style="background-color:#f5f5f5; padding:15px; border-radius:5px; margin-bottom:20px;">
          <p><strong>Número de Factura:</strong> ${noFactura}</p>
          <p><strong>Devoto:</strong> ${devoto.nombre} ${devoto.apellido}</p>
          <p><strong>Turno:</strong> ${turno.noTurno}</p>
          <p><strong>Contraseña:</strong> ${contraseña}</p>
          <p><strong>Monto Pagado:</strong> Q. ${(montoPagar || 0).toFixed(
            2
          )}</p>
        </div>

        <!-- Frase inspiradora -->
        <blockquote style="font-style: italic; color:#6b6a6a; text-align:center; margin:30px 0;">
          «Si conociéramos el valor de la Santa Misa, ¡qué gran esfuerzo haríamos por asistir a ella!»
        </blockquote>
        <p style="text-align:center; font-size:12px; margin-top:0;">– San Juan María Vianney</p>

        <!-- Pie de página -->
        <hr style="border:1px solid #86AFB9; margin:20px 0;"/>
        <p style="text-align:center; font-size:12px; color:#6b6a6a;">
          Este es un comprobante electrónico de pago. Guárdelo para su registro.
        </p>
      </div>
    `;
    if (devoto.email) {
      await sgMail.send({
        to: devoto.email,
        from: "hermandadsantamartazona3@gmail.com",
        subject: `Pago de Turno - ${turno.procesion.nombre}`,
        html: htmlFactura,
      });
    }

    res.status(201).json({
      success: true,
      compra,
      devoto,
      message: `Turno reservado como ${tipoReserva}. Monto total: Q${montoPagar}`,
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
    const turnoDevoto = devoto.turnos.find(
      (t) => t.turnoId.toString() === compra.turno.toString()
    );
    if (!turnoDevoto) {
      return res
        .status(404)
        .json({ error: "Turno no encontrado en el devoto" });
    }

    // Actualizar montos
    const nuevoMontoPagado = compra.montoPagado + monto;
    const saldoPendiente = compra.montoTotal - nuevoMontoPagado;

    // Validar que no se pague más del total
    if (nuevoMontoPagado > compra.montoTotal) {
      return res.status(400).json({
        error: `El monto excede el total. Saldo pendiente: ${
          compra.montoTotal - compra.montoPagado
        }`,
      });
    }

    // Determinar estado del pago
    let nuevoEstado = "NO_PAGADO";
    if (nuevoMontoPagado >= compra.montoTotal) {
      nuevoEstado = "PAGADO";
    } else if (nuevoMontoPagado >= compra.montoTotal / 2) {
      nuevoEstado = "MITAD";
    }

    // Actualizar compra
    compra.montoPagado = nuevoMontoPagado;
    compra.estadoPago = nuevoEstado;
    compra.pagos.push({
      monto,
      usuario: usuarioId,
    });

    // Actualizar devoto
    turnoDevoto.montoPagado = nuevoMontoPagado;
    turnoDevoto.estadoPago = nuevoEstado;
    turnoDevoto.ultimoPago = {
      fecha: new Date(),
      monto,
      usuario: usuarioId,
    };

    await Promise.all([compra.save(), devoto.save()]);

    const htmlFactura = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border:1px solid #ddd; padding:20px; border-radius:8px; background-color:#f9f9f9;">
        
        <!-- Logo -->
        <div style="text-align:center; margin-bottom:20px;">
          <img src="https://imgur.com/a/Z2qC84U" alt="Logo Hermandad" style="width:100px; height:auto;">
        </div>

        <!-- Encabezado principal -->
        <h1 style="color: #403f3f; text-align:center; margin-bottom:5px;">Pago de Turno 2026 - ${
          procesion.nombre
        }</h1>
        <h3 style="color:#59818B; text-align:center; margin-top:0; font-weight:normal;">
          Hermandad de Jesús Nazareno Redentor de los Cautivos y Virgen de Dolores <br/>
          Parroquia Santa Marta
        </h3>
        <hr style="border:1px solid #86AFB9; margin:20px 0;"/>

        <!-- Datos de la factura -->
        <div style="background-color:#f5f5f5; padding:15px; border-radius:5px; margin-bottom:20px;">
          <p><strong>Número de Factura:</strong> ${numeroFactura}</p>
          <p><strong>Devoto:</strong> ${devoto.nombre} ${devoto.apellido}</p>
          <p><strong>Turno:</strong> ${turno.noTurno}</p>
          <p><strong>Contraseña:</strong> ${nuevaContraseña}</p>
          <p><strong>Monto Pagado:</strong> Q. ${(turno.precio || 0).toFixed(
            2
          )}</p>
        </div>

        <!-- Frase inspiradora -->
        <blockquote style="font-style: italic; color:#6b6a6a; text-align:center; margin:30px 0;">
          «Si conociéramos el valor de la Santa Misa, ¡qué gran esfuerzo haríamos por asistir a ella!»
        </blockquote>
        <p style="text-align:center; font-size:12px; margin-top:0;">– San Juan María Vianney</p>

        <!-- Pie de página -->
        <hr style="border:1px solid #86AFB9; margin:20px 0;"/>
        <p style="text-align:center; font-size:12px; color:#6b6a6a;">
          Este es un comprobante electrónico de pago. Guárdelo para su registro.
        </p>
      </div>
    `;
    if (devoto.email) {
      await sgMail.send({
        to: devoto.email,
        from: "hermandadsantamartazona3@gmail.com",
        subject: `Pago de Turno - ${procesion.nombre}`,
        html: htmlFactura,
      });
    }

    res.status(200).json({
      success: true,
      compra,
      devoto,
      saldoPendiente,
      message: `Pago registrado. Estado actual: ${nuevoEstado}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const generarFacturaPDF = async (req, res) => {
  try {
    const { noFactura } = req.params;

    if (!noFactura || typeof noFactura !== "string") {
      return res.status(400).json({ error: "Número de factura inválido" });
    }

    const factura = await Compra.findOne({ noFactura })
      .populate("devoto")
      .populate({
        path: "turno",
        populate: { path: "procesion" },
      })
      .populate("usuario");

    if (!factura) {
      return res.status(404).json({ error: "Factura no encontrada" });
    }

    if (!factura.devoto || !factura.turno || !factura.usuario) {
      return res.status(400).json({ error: "Datos incompletos en la factura" });
    }

    const turnosFiltrados =
      factura.devoto?.turnos?.filter((t) => {
        try {
          return t?.turnoId?.toString() === factura.turno?._id?.toString();
        } catch {
          return false;
        }
      }) || [];

    const contraseña =
      turnosFiltrados.length > 0
        ? turnosFiltrados[turnosFiltrados.length - 1]?.contraseñas || ""
        : "";

    // Configuración del documento con tus medidas exactas
    const doc = new PDFDocument({
      size: [600, 612], // Medidas específicas solicitadas
      margin: 20, // Márgenes reducidos para mejor uso del espacio
      layout: "portrait",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Recibo_${noFactura}.pdf`
    );

    doc.pipe(res);

    // Colores
    const darkGray = "#403f3f";
    const mediumGray = "#6b6a6a";
    const lightGray = "#f5f5f5";

    // Fondo blanco
    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#ffffff");

    // Logo (si existe)
    try {
      const rutaLogo = path.join(__dirname, "logo_hermandad.png");
      if (fs.existsSync(rutaLogo)) {
        doc.image(rutaLogo, 30, 20, { width: 50, height: 50 });
      }
    } catch (imageError) {
      console.error("Error al cargar imagen:", imageError);
    }

    // Encabezado - Nombre de la procesión
    const nombreProcesion =
      factura.turno?.procesion?.nombre?.toUpperCase() ||
      "PROCESIÓN NO ESPECIFICADA";

    doc
      .fillColor(darkGray)
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(nombreProcesion, 90, 30, {
        width: doc.page.width - 120,
        align: "left",
      });

    // Línea divisora
    doc
      .moveTo(30, 80)
      .lineTo(doc.page.width - 30, 80)
      .lineWidth(1)
      .strokeColor(lightGray)
      .stroke();

    // Información de factura
    const infoY = 90;
    const fechaFactura = factura.createdAt
      ? new Date(factura.createdAt)
      : new Date();

    // Encabezados de información
    doc
      .fillColor(mediumGray)
      .font("Helvetica")
      .fontSize(10)
      .text("NÚMERO:", 30, infoY)
      .text("FECHA:", 230, infoY)
      .text("HORA:", 430, infoY);

    // Datos de información
    doc
      .fillColor(darkGray)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(factura.noFactura || "N/A", 30, infoY + 15)
      .text(fechaFactura.toLocaleDateString("es-GT"), 230, infoY + 15)
      .text(
        fechaFactura.toLocaleTimeString("es-GT", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        430,
        infoY + 15
      );

    // Sección Devoto
    const devotoY = infoY + 45;
    doc.rect(30, devotoY - 10, doc.page.width - 60, 50).fill(lightGray);

    const nombreCompleto = `${factura.devoto?.nombre || ""} ${
      factura.devoto?.apellido || ""
    }`.trim();

    doc
      .fillColor(mediumGray)
      .font("Helvetica")
      .fontSize(10)
      .text("DEVOTO", 35, devotoY - 5);

    doc
      .fillColor(darkGray)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(nombreCompleto || "Nombre no disponible", 35, devotoY + 15, {
        width: doc.page.width - 70,
      });

    // Detalles de pago
    const detailsY = devotoY + 60;
    const colWidth = (doc.page.width - 60) / 3;

    // Encabezados de detalles
    doc
      .fillColor(mediumGray)
      .font("Helvetica")
      .fontSize(10)
      .text("CONTRASEÑA", 30, detailsY)
      .text("TURNO", 30 + colWidth, detailsY)
      .text("MONTO", 30 + colWidth * 2, detailsY, { align: "right" });

    // Línea divisora
    doc
      .moveTo(30, detailsY + 15)
      .lineTo(doc.page.width - 30, detailsY + 15)
      .lineWidth(0.5)
      .strokeColor(lightGray)
      .stroke();

    // Datos de detalles
    doc
      .fillColor(darkGray)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(contraseña, 30, detailsY + 25, { width: colWidth })
      .text(factura.turno?.noTurno || "N/A", 30 + colWidth, detailsY + 25, {
        width: colWidth,
      })
      .text(
        `Q. ${factura.montoPagado?.toFixed(2) || "0.00"}`,
        30 + colWidth * 2,
        detailsY + 25,
        { width: colWidth, align: "right" }
      );

    // Vendedor
    const sellerY = detailsY + 50;
    doc
      .fillColor(mediumGray)
      .font("Helvetica")
      .fontSize(9)
      .text("ATENDIDO POR:", 30, sellerY);

    doc
      .fillColor(darkGray)
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(
        factura.usuario?.nombre || "Vendedor no especificado",
        30,
        sellerY + 15
      );

    // Frase final (ajustada más arriba)
    const footerY = sellerY + 60; // Posición más alta que antes

    doc
      .fillColor(mediumGray)
      .font("Times-Italic")
      .fontSize(10)
      .text(
        "«Si conociéramos el valor de la Santa Misa, ¡qué gran esfuerzo haríamos por asistir a ella!»",
        30,
        footerY,
        {
          width: doc.page.width - 60,
          align: "center",
        }
      );

    doc.font("Times-Roman").fontSize(9).text("– San Juan María Vianney", {
      align: "center",
    });

    doc.end();
  } catch (error) {
    console.error("Error al generar factura PDF:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Error al generar el recibo en PDF",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
};

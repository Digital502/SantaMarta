import Devoto from "./devoto.model.js";
import Turno from "../turno/turno.model.js";
import Procesion from "../procesion/procesion.model.js";
import mongoose from "mongoose";

export const addDevoto = async (req, res) => {
  try {
    const data = req.body;

    let ultimaContra = null;
    const turnosProcesados = [];

    if (Array.isArray(data.turnos)) {
  for (const turnoData of data.turnos) {
    const turnoId = turnoData.uid || turnoData;

    if (!mongoose.Types.ObjectId.isValid(turnoId)) continue;

    const turno = await Turno.findById(turnoId);
    if (!turno || turno.tipoTurno !== "COMISION") continue;

    const procesion = await Procesion.findById(turno.procesion);
    if (!procesion) continue;

    // Generar iniciales para contraseña
    const inicialesTurno = turno.noTurno
      .toString()
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase();

    const inicialesProcesion = procesion.nombre
      .split(' ')
      .map(word => word[0])
      .join('')
      .substring(0, 3)
      .toUpperCase();

    const prefijoContraseña = `${inicialesTurno}${inicialesProcesion}`;

    const ultimoDevotoConEsteTurno = await Devoto.findOne({
      "turnos.turnoId": turno._id,
      "turnos.contraseñas": { $regex: `^${prefijoContraseña}\\d{3}$`, $options: 'i' }
    })
    .sort({ createdAt: -1 })
    .select('turnos');

    let siguienteNumero = 1;

    if (ultimoDevotoConEsteTurno) {
      const contraseñasTurno = ultimoDevotoConEsteTurno.turnos
        .filter(t => t.turnoId.toString() === turno._id.toString())
        .map(t => t.contraseñas)
        .filter(c => c && c.match(new RegExp(`^${prefijoContraseña}(\\d{3})$`, 'i')));

      if (contraseñasTurno.length > 0) {
        const numeros = contraseñasTurno.map(c => {
          const match = c.match(new RegExp(`^${prefijoContraseña}(\\d{3})$`, 'i'));
          return match ? parseInt(match[1], 10) : 0;
        });

        siguienteNumero = Math.max(...numeros) + 1;
      }
    }

    const nuevaContraseña = `${prefijoContraseña}${siguienteNumero.toString().padStart(3, '0')}`;

    turnosProcesados.push({
      turnoId: turno._id,
      estadoPago: "NO_PAGADO",
      contraseñas: nuevaContraseña
    });

    // ✅ Actualizar cantidadVendida y cantidadSinVender
    turno.cantidadVendida += 1;
    turno.cantidadSinVender = Math.max(turno.cantidad - turno.cantidadVendida, 0);
    await turno.save(); // guardar cambios

    ultimaContra = nuevaContraseña;
  }

  data.turnos = turnosProcesados;
}
    // Elimina contraseñas separadas para evitar conflictos si llegan en el body
    delete data.contraseñas;

    const newDevoto = await Devoto.create(data);

    return res.status(200).json({
      message: "Devoto agregado correctamente",
      newDevoto,
      contraseñaGenerada: ultimaContra,
    });
  } catch (err) {
    console.error("Error en addDevoto:", err);
    return res.status(500).json({
      message: "Error al agregar devoto",
      error: err.message,
    });
  }
};

export const getDevotos = async (req, res) => {
  try {
    const devotos = await Devoto.find({ state: true })
      .populate({
        path: "turnos.turnoId",
        populate: {
          path: "procesion",
          select: "nombre fecha descripcion"
        }
      });

    if (devotos.length > 0) {
      // Mapea cada devoto para mostrar turnos con contraseña y datos procesion
      const devotosMapeados = devotos.map(devoto => {
        const turnosCompletos = devoto.turnos.map(t => ({
          turno: t.turnoId,
          estadoPago: t.estadoPago,
          contraseña: t.contraseñas,
          procesionNombre: t.turnoId?.procesion?.nombre || "Procesión no disponible",
          procesionFecha: t.turnoId?.procesion?.fecha || "Fecha no disponible"
        }));

        return {
          ...devoto.toObject(),
          turnos: turnosCompletos
        };
      });

      return res.status(200).json({
        message: "Devotos obtenidos correctamente",
        devotos: devotosMapeados,
      });
    }

    return res.status(404).json({
      message: "No se encontraron devotos",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error al obtener devotos",
      error: err.message,
    });
  }
};

export const getDevotoById = async (req, res) => {
  try {
    const { id } = req.params;

    const devoto = await Devoto.findById(id)
      .populate({
        path: "turnos.turnoId",
        select: "noTurno precio tipoTurno ",
        populate: {
          path: "procesion",
          select: "nombre fecha descripcion"
        }
      });

    if (!devoto) {
      return res.status(404).json({
        message: "Devoto no encontrado",
      });
    }

    const turnosCompletos = devoto.turnos.map(t => ({
      turno: t.turnoId,
      estadoPago: t.estadoPago,
      contraseñas: t.contraseñas,
      montoPagado: t.montoPagado,
      noTurno: t.turnoId?.noTurno, 
      procesionNombre: t.turnoId?.procesion?.nombre || "Procesión no disponible",
      procesionFecha: t.turnoId?.procesion?.fecha || "Fecha no disponible"
    }));

    return res.status(200).json({
      message: "Devoto obtenido correctamente",
      devoto: {
        ...devoto.toObject(),
        turnos: turnosCompletos
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error al obtener devoto",
      error: err.message,
    });
  }
};

export const updateDevoto = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Si quieres actualizar turnos con contraseña, debe hacerse cuidadosamente

    const updatedDevoto = await Devoto.findByIdAndUpdate(id, data, { new: true });

    if (updatedDevoto) {
      return res.status(200).json({
        message: "Devoto actualizado correctamente",
        updatedDevoto,
      });
    }

    return res.status(404).json({
      message: "Devoto no encontrado",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error al actualizar devoto",
      error: err.message,
    });
  }
};

export const deleteDevoto = async (req, res) => {
  try {
    const { id } = req.params;

    const devoto = await Devoto.findById(id).populate("turnos.turnoId");

    if (!devoto) {
      return res.status(404).json({ message: "Devoto no encontrado" });
    }

    for (const t of devoto.turnos) {
      if (t.turnoId && t.turnoId.tipoTurno === "COMISION") {
        await Turno.findByIdAndUpdate(
          t.turnoId._id,
          {
            $inc: { cantidadVendida: -1, cantidadSinVender: +1 }
          },
          { new: true }
        );
      }
    }

    await Devoto.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Devoto eliminado correctamente y turnos actualizados",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Error al eliminar devoto",
      error: err.message,
    });
  }
};

export const getDevotosByTurno = async (req, res) => {
  try {
    const { turnoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(turnoId)) {
      return res.status(400).json({ message: "ID de turno inválido" });
    }

    const devotos = await Devoto.find({
      state: true,
      "turnos.turnoId": turnoId
    })
    .populate({
      path: "turnos.turnoId",
      select: "noTurno"
    });

    const devotosMapeados = devotos.flatMap(devoto =>
      devoto.turnos
        .filter(t => t.turnoId && t.turnoId._id.toString() === turnoId)
        .map(t => ({
          nombre: `${devoto.nombre} ${devoto.apellido}`,
          noTurno: t.turnoId.noTurno,
          contraseña: t.contraseñas
        }))
    );

    return res.status(200).json({
      message: "Devotos obtenidos correctamente",
      devotos: devotosMapeados
    });

  } catch (err) {
    console.error("Error en getDevotosByTurno:", err);
    return res.status(500).json({
      message: "Error al obtener devotos",
      error: err.message
    });
  }
};



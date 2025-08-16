import Devoto from "../devoto/devoto.model.js";
import Procesion from "../procesion/procesion.model.js";

export const verificarFechaProcesion = async () => {
  const fechaActual = new Date();

  const procesionesVencidas = await Procesion.find({
    fecha: {
      $lt: new Date(fechaActual.getTime() - 14 * 24 * 60 * 60 * 1000)
    }
  });

  for (const procesion of procesionesVencidas) {
    await Devoto.updateMany(
      { "turnos.turnoId": procesion._id },
      {
        $set: {
          "turnos.$[elem].estadoPago": "NO_PAGADO",
          "turnos.$[elem].montoPagado": 0
        },
      },
      {
        arrayFilters: [{ "elem.turnoId": procesion._id }]
      }
    );
  }
};

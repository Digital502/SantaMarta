import mongoose, { Schema } from "mongoose";

const TurnoSchema = new Schema(
    {
        noTurno: {
            type: String,
            required: [true, "El numero de turno es requerido"],
        },
        direccion: {
            type: String,
            required: [true, "La direccion es requerida"],
        },
        marcha: {
            type: String,
            required: [true, "La marcha es requerida"],
        },
        cantidad: {
            type: Number,
            required: [true, "La cantidad es requerida"],
        },
        cantidadSinVender: {
            type: Number,
            default: 0
        },
        cantidadVendida: {
            type: Number,
            default: 0
        },
        precio: {
            type: Number,
        },
        tipoTurno: {
            type: String,
            enum: ["ORDINARIO", "COMISION"],
            default: "ORDINARIO",
        },
        procesion: {
            type: Schema.Types.ObjectId,
            ref: "Procesion",
            required: true,
        },
        state: {
            type: Boolean,
            default: true,
        },
    }
)

TurnoSchema.methods.toJSON = function () {
  const { __v, _id, ...turno } = this.toObject();
  turno.uid = _id;
  return turno;
};

export default mongoose.model("Turno", TurnoSchema);
import mongoose, { Schema } from "mongoose";

const ProcesionSchema = new Schema(
  {
    nombre: {
      type: String,
      required: [true, "El nombre es requerido"],
    },
    fotoProcesion: {
      type: String,
    },
    descripcion: {
      type: String,
      required: [true, "La Descripion es requerida"],
    },
    totalTurnos: {
      type: String,
      required: true,
    },
    fecha: {
      type: Date,
      required: [true, "La fecha es requerida"],
    },
    state: {
      type: Boolean,
      default: true,
    },
  },
  {
    versionKey: false,
    timeStamps: true,
  }
);

ProcesionSchema.methods.toJSON = function () {
  const { _v, _id, ...procesion } = this.toObject();
  procesion.uid = _id;
  return procesion;
};

export default mongoose.model("Procesion", ProcesionSchema);
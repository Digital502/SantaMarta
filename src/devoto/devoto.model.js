import mongoose, { Schema } from "mongoose";

const DevotoSchema = new Schema(
  {
    nombre: {
      type: String,
      required: [true, "El nombre es requerido"],
      maxLength: [30, "El nombre no puede exceder los 30 caracteres"],
    },
    apellido: {
      type: String,
      required: [true, "El apellido es requerido"],
      maxLength: [25, "El apellido no puede exceder los 30 caracteres"],
    },
    DPI: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: [true, "Email es requerido"],
    },
    telefono: {
      type: String,
      minLength: [8, "El teléfono debe tener al menos 8 caracteres"],
      required: true,
    },
    turnos: [{
      turnoId: { 
        type: Schema.Types.ObjectId, 
        ref: "Turno" 
      },
      estadoPago: {
        type: String,
        enum: ["PAGADO", "MITAD", "NO_PAGADO"],
        default: "NO_PAGADO"
      },
      contraseñas: {
        type: String,
        required: true
      },
      montoPagado: {
        type: Number,
        default: 0
      },
      ultimoPago: {
        fecha: Date,
        monto: Number,
        usuario: { type: Schema.Types.ObjectId, ref: "User" }
      }
    }],
    state: {
      type: Boolean,
      default: true,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

DevotoSchema.methods.toJSON = function () {
  const { __v, _id, ...devoto } = this.toObject();
  devoto.uid = _id;
  return devoto;
};

export default mongoose.model("Devoto", DevotoSchema);

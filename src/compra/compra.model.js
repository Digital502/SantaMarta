import mongoose, { Schema } from "mongoose";

const CompraSchema = new Schema(
  {
    noFactura: {
      type: String,
      default: "",
    },
    fechaFactura: {
      type: Date,
      default: Date.now,
    },
    devoto: {
      type: Schema.Types.ObjectId,
      ref: "Devoto",
      required: true,
    },
    turno: {
      type: Schema.Types.ObjectId,
      ref: "Turno",
      required: true,
    },
    usuario: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tipoReserva: {
      type: String,
      enum: ["COMPLETO", "MEDIO"],
    },
    estadoPago: {
      type: String,
      enum: ["PAGADO", "MITAD", "NO_PAGADO"],
      default: "NO_PAGADO",
    },
    montoTotal: {
      type: Number,
    },
    montoPagado: {
      type: Number,
      default: 0,
    },
    pagos: [
      {
        fecha: Date,
        monto: Number,
        usuario: { type: Schema.Types.ObjectId, ref: "User" },
      },
    ],
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

CompraSchema.methods.toJSON = function () {
  const { __v, _id, ...compra } = this.toObject();
  compra.uid = _id;
  return compra;
};

export default mongoose.model("Compra", CompraSchema);

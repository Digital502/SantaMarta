import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
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
      unique: true,
    },
    contraseña: {
      type: String,
      required: [true, "La contraseña es requerida"],
    },
    fotoDePerfil: {
      type: String,
    },
    telefono: {
      type: String,
      minLength: [8, "El telefono debe tener al menos 8 caracteres"],
      required: true,
    },
    direccion: {
      type: String,
      required: true,
    },
    state: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ["ROL_GENERAL", "ROL_DIRECTIVO"],
      default: "ROL_GENERAL",
    },
  },
  {
    versionKey: false,
    timeStamps: true,
  }
);

UserSchema.methods.toJSON = function () {
  const { _v, contraseña, _id, ...usuario } = this.toObject();
  usuario.uid = _id;
  return usuario;
};

export default mongoose.model("User", UserSchema);
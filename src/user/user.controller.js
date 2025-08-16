import User from "./user.model.js";
import argon2 from "argon2";
import { hash } from "argon2";

export const getMyUser = async (req, res) => {
  try {
    const userId = req.usuario._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "User data retrieved successfully",
      user: user,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error retrieving user data",
      error: err.message,
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await User.find({
      email: { $ne: "admin@redentordl.com" },
      state: true,
    });

    if (!users) {
      return res.status(404).json({
        message: "Users not found",
      });
    }

    return res.status(200).json({
      message: "Users data retrieved successfully",
      users: users,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error retrieving user data",
      error: err.message,
    });
  }
};

export const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id, { state: true });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.state) {
      return res.status(400).json({
        message: "User is deactivated",
      });
    }

    return res.status(200).json({
      message: "User data retrieved successfully",
      user: user,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error retrieving user data",
      error: err.message,
    });
  }
};

export const getDeleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(
      id,
      { state: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "User data delete successfully",
      user: user,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error retrieving user data",
      error: err.message,
    });
  }
};


export const getUpdateDirectivoUser = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const user = await User.findByIdAndUpdate(id, data, { new: true });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "User data updated successfully",
      user: user,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error updating user data",
      error: err.message,
    });
  }
};

export const cambioContraseña = async (req, res) => {
  try {
    const { email } = req.params;
    const { contraseña } = req.body;

    const user = await User.findOne({email: email});
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }
    const encryptPassword = await hash(contraseña);
    user.contraseña = encryptPassword;
    await user.save();
    return res.status(200).json({
      message: "Password updated successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error updating password",
      error: err.message,
    });
  }
};

export const modificarContraseña = async (req, res) => {
    try {
        const userId = req.usuario.id;  
        const { currentPassword, newPassword  } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: "Usuario no encontrado"
            });
        }

        const esContraseñaCorrecta = await argon2.verify(user.contraseña, currentPassword);
        if (!esContraseñaCorrecta) {
            return res.status(400).json({
                message: "La vieja contraseña no es correcta"
            });
        }

        const nuevaContraseñaHasheada = await argon2.hash(newPassword );

        user.contraseña = nuevaContraseñaHasheada;
        await user.save();

        return res.status(200).json({
            message: "Contraseña actualizada exitosamente"
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error al actualizar la contraseña",
            error: error.message
        });
    }
};

export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.usuario._id;
    const { nombre, apellido, telefono, direccion } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { nombre, apellido, telefono, direccion },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "Perfil actualizado exitosamente",
      user: updatedUser,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Error al actualizar perfil",
      error: err.message,
    });
  }
};
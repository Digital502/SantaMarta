import Procesion from "./procesion.model.js";

export const addProcesion = async (req, res) => {
    try{

        const data = req.body;

        const newProcesion = await Procesion.create(data);

        if(newProcesion){
            return res.status(200).json({
                message: "Procesion added successfully",
                newProcesion: newProcesion
            });
        }

        return res.status(400).json({
            message: "Failed to add procesion",
        });
    }catch(err){
        return res.status(500).json({
            message: "Error adding procesion",
            error: err.message,
          });
    }
}

export const getProcesiones = async (req, res) => {
    try{
        const procesiones = await Procesion.find({state: true});

        if(procesiones.length > 0){
            return res.status(200).json({
                message: "Procesiones retrieved successfully",
                procesiones
            });
        }

        return res.status(404).json({
            message: "No procesiones found",
        });
    }catch(err){
        return res.status(500).json({
            message: "Error retrieving procesiones",
            error: err.message,
          });
    }
}


export const getProcesionById = async (req, res) => {
    try{
        const { id } = req.params;
        const procesion = await Procesion.findById(id);

        if(procesion){
            return res.status(200).json({
                message: "Procesion retrieved successfully",
                procesion
            });
        }

        return res.status(404).json({
            message: "Procesion not found",
        });
    }catch(err){
        return res.status(500).json({
            message: "Error retrieving procesion",
            error: err.message,
          });
    }
}


export const updateProcesion = async (req, res) => {
    try{
        const { id } = req.params;
        const data = req.body;

        const updatedProcesion = await Procesion.findByIdAndUpdate(id, data, { new: true });    

        if(updatedProcesion){
            return res.status(200).json({
                message: "Procesion updated successfully",
                updatedProcesion
            });
        }

        return res.status(404).json({
            message: "Procesion not found",
        });

    }catch(err){
        return res.status(500).json({
            message: "Error updating procesion",
            error: err.message,
          });
    }
}


export const deleteProcesion = async (req, res) => {
    try {

        const { id } = req.params;
        const deletedProcesion = await Procesion.findByIdAndUpdate(id, { state: false }, { new: true });

        if(deletedProcesion){
            return res.status(200).json({
                message: "Procesion deleted successfully",
            });
        }

        return res.status(404).json({
            message: "Procesion not found",
        });

    }catch (err) {
        return res.status(500).json({
            message: "Error deleting procesion",
            error: err.message,
          });
    }
}
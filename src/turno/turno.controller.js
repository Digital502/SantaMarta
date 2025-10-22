import Turno from './turno.model.js'
import PDFDocument from 'pdfkit';
import Procesion from '../procesion/procesion.model.js';

export const addTurno = async (req, res) => {
  try {
    const data = req.body

    if (typeof data.cantidadSinVender === "undefined" || data.cantidadSinVender === null) {
      data.cantidadSinVender = data.cantidad || 0;
    }

    const newTurno = await Turno.create(data)

    if (newTurno) {
      return res.status(200).json({
        message: "Turno added successfully",
        newTurno
      })
    }

    return res.status(400).json({
      message: "Failed to add turno",
    })
  } catch (err) {
    return res.status(500).json({
      message: "Error adding turno",
      error: err.message
    })
  }
}

export const getTurnos = async (req, res) => {
  try {
    const turnos = await Turno.find({ state: true }).populate('procesion')

    if (turnos.length > 0) {
      return res.status(200).json({
        message: "Turnos retrieved successfully",
        turnos
      })
    }

    return res.status(404).json({
      message: "No turnos found",
    })
  } catch (err) {
    return res.status(500).json({
      message: "Error retrieving turnos",
      error: err.message
    })
  }
}

export const getTurnoById = async (req, res) => {
  try {
    const { id } = req.params
    const turno = await Turno.findById(id).populate('procesion')

    if (turno) {
      return res.status(200).json({
        message: "Turno retrieved successfully",
        turno
      })
    }

    return res.status(404).json({
      message: "Turno not found",
    })
  } catch (err) {
    return res.status(500).json({
      message: "Error retrieving turno",
      error: err.message
    })
  }
}

export const updateTurno = async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body

    const updatedTurno = await Turno.findByIdAndUpdate(id, data, { new: true })

    if (updatedTurno) {
      return res.status(200).json({
        message: "Turno updated successfully",
        updatedTurno
      })
    }

    return res.status(404).json({
      message: "Turno not found",
    })
  } catch (err) {
    return res.status(500).json({
      message: "Error updating turno",
      error: err.message
    })
  }
}

export const deleteTurno = async (req, res) => {
  try {
    const { id } = req.params
    const deletedTurno = await Turno.findByIdAndUpdate(id, { state: false }, { new: true })

    if (deletedTurno) {
      return res.status(200).json({
        message: "Turno deleted successfully"
      })
    }

    return res.status(404).json({
      message: "Turno not found",
    })
  } catch (err) {
    return res.status(500).json({
      message: "Error deleting turno",
      error: err.message
    })
  }
}

export const getTurnosByProcesionId = async (req, res) => {
  try {
    const { procesionId } = req.params

    const turnos = await Turno.find({ procesion: procesionId, state: true }).populate('procesion', 'nombre').sort({ noTurno: 1 });
    
    if (turnos.length > 0) {
      return res.status(200).json({
        message: "Turnos retrieved successfully by procesion",
        turnos
      })
    }

    return res.status(404).json({
      message: "No turnos found for this procesion",
    })
  } catch (err) {
    return res.status(500).json({
      message: "Error retrieving turnos by procesion",
      error: err.message
    })
  }
}

export const downloadTurnosPdf = async (req, res) => {
  try {
    const { procesionId } = req.params;

    const procesion = await Procesion.findById(procesionId);
    const turnos = await Turno.find({ procesion: procesionId, state: true });

    if (!procesion) {
      return res.status(404).json({ message: "Procesión no encontrada" });
    }

    // Configuración del documento en horizontal con márgenes ajustados
    const doc = new PDFDocument({
      margin: 20,
      size: "A4",
      layout: "landscape",
      bufferPages: true
    });

    // Encabezados para descarga
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Turnos_${procesion.nombre.replace(/\s+/g, '_')}.pdf`
    );

    doc.pipe(res);

    // Variables de diseño
    const mainColor = '#2B535C';
    const accentColor = '#426A73';
    const lightGray = '#F5F5F5';
    const textColor = '#333333';
    const footerHeight = 30;

    // Función para dibujar encabezado
    const drawHeader = () => {
      doc.fillColor(mainColor)
         .fontSize(18)
         .font('Helvetica-Bold')
         .text(`INVENTARIO DE TURNOS - ${procesion.nombre.toUpperCase()}`, {
           align: "center"
         });
      
      doc.moveDown(0.5);
    };

    // Función para dibujar tabla
    const drawTable = () => {
      const tableTop = 80;
      const marginLeft = 20;
      const rowHeight = 22;
      const availableWidth = doc.page.width - 40;
      
      // Distribución de columnas (porcentajes del ancho disponible)
      const columns = [
        { name: "No", width: availableWidth * 0.08, align: 'center' },    // 8%
        { name: "Dirección", width: availableWidth * 0.50, align: 'left' }, // 50%
        { name: "Marcha", width: availableWidth * 0.22, align: 'left' },   // 22%
        { name: "Cantidad", width: availableWidth * 0.10, align: 'center' }, // 10%
        { name: "Precio (Q)", width: availableWidth * 0.10, align: 'right' } // 10%
      ];

      // Encabezado de tabla
      doc.fillColor(accentColor)
         .rect(marginLeft, tableTop, availableWidth, rowHeight)
         .fill();
      
      doc.fillColor('#FFFFFF')
         .font('Helvetica-Bold')
         .fontSize(10);

      let x = marginLeft;
      columns.forEach(column => {
        doc.text(column.name, x + 5, tableTop + 6, { 
          width: column.width - 10,
          align: column.align
        });
        x += column.width;
      });

      // Filas de la tabla
      doc.font('Helvetica')
         .fontSize(9);

      turnos.forEach((turno, i) => {
        const y = tableTop + (i + 1) * rowHeight;

        // Control de paginación
        if (y + rowHeight > doc.page.height - footerHeight) {
          doc.addPage();
          drawHeader();
          return drawTable(); 
        }

        // Fondo alternado
        doc.fillColor(i % 2 === 0 ? lightGray : '#FFFFFF')
           .rect(marginLeft, y, availableWidth, rowHeight)
           .fill();

        doc.fillColor(textColor);
        x = marginLeft;

        // No. Turno
        doc.text(turno.noTurno || (i + 1).toString(), x + 5, y + 6, { 
          width: columns[0].width - 10,
          align: columns[0].align
        });
        x += columns[0].width;

        // Dirección (con ajuste para texto largo)
        const direccion = doc.fontSize(8).text(turno.direccion || "-", x + 5, y + 6, { 
          width: columns[1].width - 10,
          align: columns[1].align,
          ellipsis: true // Añadir puntos suspensivos si el texto es muy largo
        });
        x += columns[1].width;

        // Marcha
        doc.fontSize(9).text(turno.marcha || "-", x + 5, y + 6, { 
          width: columns[2].width - 10,
          align: columns[2].align
        });
        x += columns[2].width;

        // Cantidad
        doc.text(turno.cantidadSinVender?.toString() || "-", x + 5, y + 6, { 
          width: columns[3].width - 10,
          align: columns[3].align
        });
        x += columns[3].width;

        // Precio
        doc.text(`Q ${turno.precio?.toFixed(2) || "0.00"}`, x + 5, y + 6, { 
          width: columns[4].width - 10,
          align: columns[4].align
        });
      });
    };

    // Función para dibujar pie de página
    const drawFooter = () => {
      const pageCount = doc.bufferedPageRange().count;
      
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        
        doc.fillColor('#777777')
           .fontSize(8)
           .text(`Generado el: ${new Date().toLocaleString()}`, 20, doc.page.height - 20, {
             width: doc.page.width - 40,
             align: "left"
           })
           .text(`Página ${i + 1} de ${pageCount}`, 20, doc.page.height - 20, {
             width: doc.page.width - 40,
             align: "right"
           });
      }
    };

    // Generar contenido
    drawHeader();
    drawTable();
    drawFooter();

    doc.end();
  } catch (error) {
    console.error("Error al generar el PDF:", error);
    res.status(500).json({
      message: "Error al generar PDF de turnos",
      error: error.message,
    });
  }
};
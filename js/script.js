// ==========================================
// DICCIONARIOS Y CONFIGURACIÓN AFIP
// ==========================================
const TIPOS_COMPROBANTE = {
    '001': 'Factura A',
    '002': 'Nota de Débito A',
    '003': 'Nota de Crédito A',
    '004': 'Recibo A',
    '006': 'Factura B',
    '007': 'Nota de Débito B',
    '008': 'Nota de Crédito B',
    '009': 'Recibo B',
    '011': 'Factura C',
    '012': 'Nota de Débito C',
    '013': 'Nota de Crédito C',
    '015': 'Recibo C',
    '019': 'Factura Exportación E',
    '020': 'Nota de Débito E',
    '021': 'Nota de Crédito E',
    '049': 'Compra Bienes Usados',
    '051': 'Factura M',
    '052': 'Nota de Débito M',
    '053': 'Nota de Crédito M',
    '054': 'Recibo M',
    '195': 'Factura T',
    '196': 'Nota de Débito T',
    '197': 'Nota de Crédito T',
    '201': 'FCE MiPyME A',
    '202': 'ND MiPyME A',
    '203': 'NC MiPyME A',
    '206': 'FCE MiPyME B',
    '207': 'ND MiPyME B',
    '208': 'NC MiPyME B',
    '211': 'FCE MiPyME C',
    '212': 'ND MiPyME C',
    '213': 'NC MiPyME C'
};

// Códigos de Notas de Crédito que RESTAN
const CODIGOS_NC = ['003', '008', '013', '021', '053', '197', '203', '208', '213'];

let facturasProcesadas = [];
let csvContenido = "";
let blobUrlCSV = "";

// ==========================================
// EVENT LISTENERS E INICIALIZACIÓN DE LA APP
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fileInput').addEventListener('change', mostrarNombreArchivo);
    document.getElementById('btnProcess').addEventListener('click', procesarArchivo);
    document.getElementById('btnDownload').addEventListener('click', descargarCSV);
    document.getElementById('btnXLSX').addEventListener('click', descargarXLSX);
    document.getElementById('btnXLS').addEventListener('click', descargarXLS);
    document.getElementById('btnODS').addEventListener('click', descargarODS);
    document.getElementById('btnTXT').addEventListener('click', descargarTXT);
});

// Registro del Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registro => {
                console.log('Service Worker registrado con éxito:', registro.scope);
            })
            .catch(error => {
                console.log('Fallo al registrar el Service Worker:', error);
            });
    });
}

// ==========================================
// MANEJO Y PROCESAMIENTO DE ARCHIVO
// ==========================================
function mostrarNombreArchivo() {
    const input = document.getElementById('fileInput');
    const fileNameDisplay = document.getElementById('file-name');
    const btnProcess = document.getElementById('btnProcess');
    
    if (input.files.length > 0) {
        fileNameDisplay.innerText = "Archivo seleccionado: " + input.files[0].name;
        btnProcess.style.display = "inline-block"; 
    } else {
        fileNameDisplay.innerText = "Ningún archivo seleccionado";
        btnProcess.style.display = "none";
    }
}

function procesarArchivo() {
    const input = document.getElementById('fileInput');
    if (input.files.length === 0) return;

    const archivo = input.files[0];
    const lector = new FileReader();

    lector.onload = function(evento) {
        const contenido = evento.target.result;
        analizarTextoAFIP(contenido); 
    };
    lector.readAsText(archivo, "UTF-8");
}

function analizarTextoAFIP(texto) {
    facturasProcesadas = []; 
    
    let totalMonto = 0;
    let totalBaseRentasCF = 0;
    let totalBaseRentasINS = 0;
    let totalImpRentas = 0;
    let totalBaseTasa = 0;
    let totalImpTasa = 0;
    
    const lineas = texto.split(/\r?\n/);

    lineas.forEach(linea => {
        if (linea.startsWith('1')) {
            if (linea.length < 274) return; 

            const fechaRaw = linea.substring(1, 9);
            const codRaw = linea.substring(9, 12).trim();
            const codAfip = codRaw.padStart(3, '0');
            
            const ptoVta = linea.substring(12, 16);
            const nroCbte = linea.substring(16, 24);
            const docTipo = linea.substring(35, 37); 
            const cliente = linea.substring(48, 78).trim(); 
            const cae = linea.substring(260, 274);
            
            const nombreCbte = TIPOS_COMPROBANTE[codAfip] || `Comprobante ${codAfip}`;
            const esNC = CODIGOS_NC.includes(codAfip);
            
            let importeBruto = parseFloat(linea.substring(78, 93)) / 100;
            
            if (esNC) {
                importeBruto = -Math.abs(importeBruto);
            }

            let esInscripto = (docTipo === '80');
            let condicionNombre = esInscripto ? 'INSCRIPTO' : 'C. FINAL';

            if (esInscripto) {
                totalBaseRentasINS += importeBruto;
            } else {
                totalBaseRentasCF += importeBruto;
            }
            
            const impuestoRentas = importeBruto * 0.045; 
            const baseTasa = importeBruto - impuestoRentas; 
            const impuestoTasa = baseTasa * 0.01; 

            totalMonto += importeBruto;
            totalImpRentas += impuestoRentas;
            totalBaseTasa += baseTasa;
            totalImpTasa += impuestoTasa;

            facturasProcesadas.push({
                codAfip: codAfip,
                tipoCbteTexto: nombreCbte,
                esNotaCredito: esNC,
                comprobante: `${ptoVta}-${nroCbte}`,
                fecha: `${fechaRaw.substring(6,8)}/${fechaRaw.substring(4,6)}/${fechaRaw.substring(0,4)}`,
                cliente: cliente,
                cae: cae,
                condicion: condicionNombre,
                esInscripto: esInscripto,
                
                totalNum: importeBruto,
                baseRentasNum: importeBruto,
                impRentasNum: impuestoRentas,
                baseTasaNum: baseTasa,
                impTasaNum: impuestoTasa
            });
        }
    });

    actualizarUI(totalMonto, totalBaseRentasCF, totalBaseRentasINS, totalImpRentas, totalBaseTasa, totalImpTasa);
    prepararCSV(); 
}

// ==========================================
// FUNCIONES DE FORMATEO Y UI
// ==========================================
function fMontoTabla(valor) {
    const esNegativo = valor < 0;
    const absVal = Math.abs(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return esNegativo ? `-$ ${absVal}` : `$ ${absVal}`;
}

function fMoneda(valor) {
    const esNegativo = valor < 0;
    const absVal = Math.abs(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (esNegativo ? '-$' : '$') + absVal;
}

function fCrudo(valor) {
    return valor.toFixed(2).replace('.', ',');
}

function fAnglo(valor) {
    return valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
}

function actualizarUI(monto, bRentasCF, bRentasINS, iRentas, bTasa, iTasa) {
    document.getElementById('kpi-cantidad').innerText = facturasProcesadas.length;
    document.getElementById('kpi-monto').innerText = fMoneda(monto);
    document.getElementById('kpi-base-rentas-cf').innerText = fMoneda(bRentasCF);
    document.getElementById('kpi-base-rentas-ins').innerText = fMoneda(bRentasINS);
    document.getElementById('kpi-imp-rentas').innerText = fMoneda(iRentas);
    document.getElementById('kpi-base-tasa').innerText = fMoneda(bTasa);
    document.getElementById('kpi-imp-tasa').innerText = fMoneda(iTasa);

    document.getElementById('raw-cantidad').innerText = facturasProcesadas.length;
    document.getElementById('raw-monto').innerText = fCrudo(monto);
    document.getElementById('raw-base-rentas-cf').innerText = fCrudo(bRentasCF);
    document.getElementById('raw-base-rentas-ins').innerText = fCrudo(bRentasINS);
    document.getElementById('raw-imp-rentas').innerText = fCrudo(iRentas);
    document.getElementById('raw-base-tasa').innerText = fAnglo(bTasa);
    document.getElementById('raw-imp-tasa').innerText = fCrudo(iTasa);

    const tbody = document.getElementById('table-body');
    tbody.innerHTML = ''; 

    facturasProcesadas.forEach(f => {
        const tr = document.createElement('tr');
        if (f.esNotaCredito) {
            tr.classList.add('fila-nc');
        }

        const badgeCond = f.esInscripto ? `<span class="badge-cond bg-ins">INSCRIPTO</span>` : `<span class="badge-cond bg-cf">C. FINAL</span>`;
        const badgeTipoCss = f.esNotaCredito ? 'badge-tipo badge-nc' : 'badge-tipo';
        const claseMonto = f.esNotaCredito ? 'monto monto-negativo' : 'monto';
        
        tr.innerHTML = `
            <td><span class="badge-code">${f.codAfip}</span></td>
            <td><span class="${badgeTipoCss}">${f.tipoCbteTexto}</span></td>
            <td><strong>${f.comprobante}</strong></td>
            <td>${f.fecha}</td>
            <td>${f.cliente}</td>
            <td>${f.cae}</td>
            <td>${badgeCond}</td>
            <td class="${claseMonto}">${fMontoTabla(f.totalNum)}</td>
            <td class="${claseMonto} col-calc">${fMontoTabla(f.baseRentasNum)}</td>
            <td class="${claseMonto} col-calc">${fMontoTabla(f.impRentasNum)}</td>
            <td class="${claseMonto} col-calc">${fMontoTabla(f.baseTasaNum)}</td>
            <td class="${claseMonto} col-calc">${fMontoTabla(f.impTasaNum)}</td>
        `;
        tbody.appendChild(tr); 
    });
}

function obtenerMatrizDatos() {
    const datos = [
        ["Código", "Tipo de Comprobante", "Número", "Fecha", "Cliente", "CAE", "Condición", "Total ($)", "Base Imponible Rentas", "Impuesto Rentas Mnes", "Base Imponible Tasa MP", "Impuesto Tasa MP"]
    ];

    facturasProcesadas.forEach(f => {
        datos.push([
            f.codAfip, f.tipoCbteTexto, f.comprobante, f.fecha, f.cliente, f.cae, f.condicion,
            f.totalNum, f.baseRentasNum, f.impRentasNum, f.baseTasaNum, f.impTasaNum
        ]);
    });

    return datos;
}

// ==========================================
// FUNCIONES DE EXPORTACIÓN Y DESCARGA
// ==========================================
function prepararCSV() {
    const cabeceras = [
        '"Código"', '"Tipo Comprobante"', '"Número"', '"Fecha"', '"Cliente"', '"CAE"', '"Condición"', '"Total ($)"', 
        '"Base Imponible DDJJ Rentas"', '"Impuesto DJM Rentas Mnes"', 
        '"Base imponible DJM Tasa MP"', '"Impuesto DJM Tasa MP"'
    ];
    csvContenido = cabeceras.join(';') + '\r\n'; 

    facturasProcesadas.forEach(f => {
        const fila = [
            `"${f.codAfip}"`, `"${f.tipoCbteTexto}"`, `"${f.comprobante}"`, `"${f.fecha}"`, `"${f.cliente}"`, `"${f.cae}"`,
            `"${f.condicion}"`,
            `"${f.totalNum.toFixed(2).replace('.', ',')}"`, 
            `"${f.baseRentasNum.toFixed(2).replace('.', ',')}"`, 
            `"${f.impRentasNum.toFixed(2).replace('.', ',')}"`,
            `"${f.baseTasaNum.toFixed(2).replace('.', ',')}"`, 
            `"${f.impTasaNum.toFixed(2).replace('.', ',')}"`
        ];
        csvContenido += fila.join(';') + '\r\n';
    });

    const blob = new Blob(["\uFEFF" + csvContenido], { type: 'text/csv;charset=utf-8;' });
    blobUrlCSV = URL.createObjectURL(blob); 
    
    const btn = document.getElementById('btnDownload');
    btn.href = blobUrlCSV; 
    btn.download = "liquidaciones_afip.csv";
}

function descargarCSV(evento) {
    if (facturasProcesadas.length === 0) {
        evento.preventDefault();
        alert("⚠️ Primero tenés que seleccionar y procesar un archivo CABECERA.txt para poder descargar los datos.");
    }
}

function descargarXLSX() {
    if (facturasProcesadas.length === 0) {
        alert("⚠️ Primero tenés que seleccionar y procesar un archivo CABECERA.txt para poder descargar los datos.");
        return;
    }
    const hoja = XLSX.utils.aoa_to_sheet(obtenerMatrizDatos());
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Liquidaciones AFIP");
    XLSX.writeFile(libro, "liquidaciones_afip.xlsx");
}

function descargarXLS() {
    if (facturasProcesadas.length === 0) {
        alert("⚠️ Primero tenés que seleccionar y procesar un archivo CABECERA.txt para poder descargar los datos.");
        return;
    }
    const hoja = XLSX.utils.aoa_to_sheet(obtenerMatrizDatos());
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Liquidaciones AFIP");
    XLSX.writeFile(libro, "liquidaciones_afip.xls", { bookType: 'biff8' });
}

function descargarODS() {
    if (facturasProcesadas.length === 0) {
        alert("⚠️ Primero tenés que seleccionar y procesar un archivo CABECERA.txt para poder descargar los datos.");
        return;
    }
    const hoja = XLSX.utils.aoa_to_sheet(obtenerMatrizDatos());
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Liquidaciones AFIP");
    XLSX.writeFile(libro, "liquidaciones_afip.ods", { bookType: 'ods' });
}

function descargarTXT() {
    if (facturasProcesadas.length === 0) {
        alert("⚠️ Primero tenés que seleccionar y procesar un archivo CABECERA.txt para poder descargar los datos.");
        return;
    }
    
    const cabeceras = ["Código", "Tipo Comprobante", "Número", "Fecha", "Cliente", "CAE", "Condición", "Total ($)", "Base Imp. Rentas", "Imp. Rentas Mnes", "Base Tasa MP", "Imp. Tasa MP"];
    let txtContenido = cabeceras.join('\t') + '\r\n';

    facturasProcesadas.forEach(f => {
        const fila = [
            f.codAfip,
            f.tipoCbteTexto,
            f.comprobante,
            f.fecha,
            f.cliente,
            f.cae,
            f.condicion,
            f.totalNum.toFixed(2).replace('.', ','),
            f.baseRentasNum.toFixed(2).replace('.', ','),
            f.impRentasNum.toFixed(2).replace('.', ','),
            f.baseTasaNum.toFixed(2).replace('.', ','),
            f.impTasaNum.toFixed(2).replace('.', ',')
        ];
        txtContenido += fila.join('\t') + '\r\n';
    });

    const blob = new Blob(["\uFEFF" + txtContenido], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "liquidaciones_afip.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
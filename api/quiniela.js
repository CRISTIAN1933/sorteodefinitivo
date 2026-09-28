 
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";
import cheerio from "cheerio";

// ============================================================
// FIREBASE
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyBSDxMJucGb_rBFKYtNkOfQsyv4RIZNbL4",
    authDomain: "sorteos-chino.firebaseapp.com",
    databaseURL: "https://sorteos-chino-default-rtdb.firebaseio.com",
    projectId: "sorteos-chino",
    storageBucket: "sorteos-chino.firebasestorage.app",
    messagingSenderId: "336693302473",
    appId: "1:336693302473:web:4d18cc80adefc2a684a918"
};

// Inicializar Firebase una sola vez
const app = getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig);

const db = getDatabase(app);


// ============================================================
// OBTENER NÚMERO
// ============================================================

function obtenerNumero($, id) {

    const elemento = $("#" + id);

    if (!elemento.length) {
        return null;
    }

    let numero = elemento.text().trim();

    numero = numero.replace(/\s+/g, "");

    if (/^\d+$/.test(numero)) {
        numero = numero.padStart(4, "0");
    }

    return numero;
}


// ============================================================
// EXTRAER QUINIELA
// ============================================================

function extraerQuiniela($, codigo, titulo, descripcion) {

    const resultados = [];

    for (let pos = 1; pos <= 20; pos++) {

        const posicion = String(pos).padStart(2, "0");

        const id = `idQ${codigo}_5_N${posicion}`;

        const numero = obtenerNumero($, id);

        if (numero === null) {
            throw new Error(
                `No se encontró el elemento ${id}`
            );
        }

        resultados.push({
            numero: numero,
            pos: String(pos)
        });
    }

    return {
        descripcion: descripcion,
        resultados: resultados,
        titulo: titulo
    };
}


// ============================================================
// EXTRAER FECHA
// ============================================================

function extraerFecha($) {

    const textoCompleto = $("body")
        .text()
        .replace(/\s+/g, " ")
        .trim();

    const regex =
        /Resultados\s+del\s+d[ií]a\s+.*?(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i;

    const match = textoCompleto.match(regex);

    if (!match) {
        return null;
    }

    const dia = String(match[1]).padStart(2, "0");

    const mesTexto = match[2].toLowerCase();

    const año = match[3];

    const meses = {
        enero: "01",
        febrero: "02",
        marzo: "03",
        abril: "04",
        mayo: "05",
        junio: "06",
        julio: "07",
        agosto: "08",
        septiembre: "09",
        octubre: "10",
        noviembre: "11",
        diciembre: "12"
    };

    const mes = meses[mesTexto];

    if (!mes) {
        return null;
    }

    return {
        fecha: `${dia}-${mes}-${año}`,
        fecha_iso: `${año}-${mes}-${dia}`,
        fecha_texto: match[0]
    };
}


// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

export default async function handler(req, res) {

    try {

        // ====================================================
        // URL DE LA PÁGINA
        // ====================================================

        const url = process.env.QUINIELA_URL;

        if (!url) {

            return res.status(500).json({
                ok: false,
                error: "Falta configurar QUINIELA_URL en Vercel"
            });

        }


        // ====================================================
        // DESCARGAR HTML
        // ====================================================

        const respuesta = await fetch(url, {

            method: "GET",

            headers: {
                "User-Agent":
                    "Mozilla/5.0 (compatible; QuinielaExtractor/1.0)"
            }

        });


        if (!respuesta.ok) {

            throw new Error(
                `La página respondió HTTP ${respuesta.status}`
            );

        }


        const html = await respuesta.text();


        // ====================================================
        // ANALIZAR HTML
        // ====================================================

        const $ = cheerio.load(html);


        // ====================================================
        // FECHA
        // ====================================================

        const fechaInfo = extraerFecha($);


        if (!fechaInfo) {

            throw new Error(
                "No se pudo encontrar la fecha de resultados en la página"
            );

        }


        // ====================================================
        // EXTRAER MENDOZA
        // ====================================================

        const mendoza = extraerQuiniela(
            $,
            "9",
            "Quiniela de Mendoza",
            "LA PREVIA MENDOZA"
        );


        // ====================================================
        // EXTRAER CIUDAD
        // ====================================================

        const ciudad = extraerQuiniela(
            $,
            "26",
            "Quiniela de la Ciudad",
            "LA PREVIA CIUDAD"
        );


        // ====================================================
        // CONSTRUIR DATOS
        // ====================================================

        const ahora = new Date();

        const datos = {

            fecha: fechaInfo.fecha,

            fecha_texto:
                fechaInfo.fecha_texto,

            quinielas: [

                mendoza,

                ciudad

            ],

            updated_at:
                ahora.toISOString()

        };


        // ====================================================
        // OBJETO FINAL
        // ====================================================

        const quiniela = {

            data: datos,

            ultima_fecha_guardada:
                fechaInfo.fecha

        };


        // ====================================================
        // GUARDAR EN FIREBASE REALTIME DATABASE
        // ====================================================

        await set(
            ref(db, "quiniela"),
            quiniela
        );


        // ====================================================
        // RESPUESTA
        // ====================================================

        return res.status(200).json({

            ok: true,

            mensaje:
                "Quiniela extraída y guardada correctamente",

            firebase_path:
                "quiniela",

            datos: quiniela

        });


    } catch (error) {

        console.error("ERROR QUINIELA:", error);

        return res.status(500).json({

            ok: false,

            error: error.message

        });

    }

}
 

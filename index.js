import fs from 'fs/promises';
import axios from 'axios';
import {JSDOM} from 'jsdom';


function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function insertarPalabra(linea) {
  const matches = linea.match(/\[(.*?)\]/g);

  if (!matches || matches.length < 3) {
    console.error(`❌ Formato inválido para la línea: ${linea}`);
    return;
  }

  const word = matches[0].replace(/^\[|\]$/g, '').trim();
  const definition = matches[1].replace(/^\[|\]$/g, '').trim();
  const latin = matches[2].replace(/^\[|\]$/g, '').trim();
  const origin = 'desconocido'; 
  

  try {
    
    const res = await axios.post(
      process.env.END_POINT_BACK_END,
      {text: word, definition, origin, latin },
      {
        headers: {
          Authorization: `Bearer ${process.env.TOKEN_CLERK_CLIENT}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Insertada: ${word}`);
  } catch (err) {
    console.error(`❌ Error insertando "${word}":`, err.response?.data || err.message);
  }
}



async function insectarPalabrasBackEnd() {
  try {
    const data = await fs.readFile('palabras.txt', 'utf-8');
    const lineas = data.split('\n').filter(l => l.trim());

    for (const linea of lineas) {
      
      
      await insertarPalabra(linea);
    }

    console.log('✅ Procesamiento finalizado.');
  } catch (error) {
    console.error('❌ Error leyendo archivo:', error.message);
  }
}


async function obtenerPalabrasFrecuentes(cantidad = 1000) {
  const res = await axios.get(
    'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt'
  );
  const texto = res.data;
  const palabras = texto.split('\n').map((linea) => linea.trim().split(' ')[0]);
  return palabras.slice(0, cantidad);
}



function extraerOrigenDesdeHTML(doc, palabraClave = "latín") {
  const resultados = [];
  const etiquetas = doc.querySelectorAll("p, li, dd, dt");

  const regexBase = new RegExp(`del\\s+${palabraClave}\\s+(.+?)([.,;]|<\\/|$)`, "i");

  etiquetas.forEach(el => {
    const rawHTML = el.innerHTML;
    const matchHTML = rawHTML.match(regexBase);

    if (matchHTML) {
      const domFrag = new JSDOM(`<div>${matchHTML[1]}</div>`);
      const textoLimpio = domFrag.window.document.body.textContent.trim();
      resultados.push(textoLimpio);
    }
  });

  const palabrasClave = resultados.join(" | ")

  return palabrasClave;
}



async function obtenerInfoWikcionario(palabra) {
  const url = `https://es.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(palabra)}&format=json&origin=*`;

  try {
    const res = await axios.get(url);
    const data = await res.data;

    if (!data.parse || !data.parse.text || !data.parse.text["*"]) {
      console.log(`❌ No se encontró la palabra "${palabra}".`);
      return null;
    }

    const html = await data.parse.text["*"];
    const dom =  await new JSDOM(html);
    const doc = await dom.window.document;

    doc.querySelectorAll("style, script").forEach(el => el.remove());



    const latinResult = await extraerOrigenDesdeHTML(doc)
    const clasesNoDeseadas = [
      ".mw-parser-output .definicion-impropia",
      ".mnv",
      ".impropia",
      ".etim",
      ".referencias",
      ".encabezado",
    ];
    clasesNoDeseadas.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    });

    const definiciones = [];
    const dd = doc.querySelectorAll("dd");

    for (const dt of dd) {
    dt.querySelectorAll("sup.reference, a").forEach(el => {
      if (/^\[\d+\]$/.test(el.textContent.trim()) || /^\d+$/.test(el.textContent.trim())) {
        el.remove();
      }
    });

    const texto = dt.textContent.trim();
    if (
      texto &&
      !/^\.mw-parser-output/.test(texto) &&
      !texto.includes("{") &&
      texto.length > 3
    ) {
      definiciones.push(texto);
    }

    if (definiciones.length === 5) break; 
  }


    if (definiciones.length === 0) {
      console.log(`⚠️ No se encontraron definiciones útiles para "${palabra}".`);
      return null;
    }

    const definicionesTexto = definiciones
    .join(" | ")
    .replace(/\n/g, " ")      
    .replace(/\s+/g, " ")     
    .trim();                  


    console.log(`📦 Resultado final para "${palabra}":`);
    console.log(definicionesTexto);

    return {
      text:palabra,
      definition: definicionesTexto,
      latin:latinResult
    };

  } catch (err) {
    console.error("💥 Error al obtener información:", err.message);
    return null;
  }
}

async function guardarPalabrasEnArchivo(lista, archivo = 'palabras.txt') {
  if (lista.length === 0) {
    console.log('\nNo se encontró ninguna palabra que cumpla los criterios. El archivo no se ha creado.');
    return;
  }
  const lineas = lista.map((p) => `[${p.text}][${p.definition}][${p.latin}]`);
  await fs.writeFile(archivo, lineas.join('\n'), 'utf-8');
  console.log(`\n\nDatos guardados en ${archivo}`);
}

async function main() {
  const palabras = await obtenerPalabrasFrecuentes(1000);
  const resultados = [];

  //const result = await obtenerInfoWikcionario("forma");

  //console.log(result);

  
  console.log(`Buscando en ${palabras.length} palabras...`);

  let contador = 0;
  for (const palabra of palabras) {
    if (palabra.length <= 2) continue;
    
    contador++;
    process.stdout.write(`\r[${contador}/${palabras.length}] Buscando: ${palabra.padEnd(20)}`);

    const info = await obtenerInfoWikcionario(palabra);
    
    if (info) {
      resultados.push(info);
    }
    await delay(50); 
  }

  await guardarPalabrasEnArchivo(resultados);


  await insectarPalabrasBackEnd();
}

main();
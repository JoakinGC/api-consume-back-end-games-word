# Consumo de API

Creación de scripts que muestran con ejemplos la creación y el añadido de palabras al back end. Sitio desplegado en (https://joakingc.github.io/api-consume-back-end-games-word/)

## ¿Cómo lo hace?

Se obtiene una lista de 1000 palabras aleatorias desde `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt`.

De ahí se realizan iteraciones sobre la lista de palabras, salteando aquellas que tienen menos de 3 caracteres. Luego consumimos la API de Wiki: `https://es.wiktionary.org`.

```javascript
if (palabra.length <= 2) continue;
...
const info = await obtenerInfoWikcionario(palabra);
```

Esta devuelve un HTML (ver en los ejemplos uno y dos), el cual se procesa para pintar toda la información de la palabra. En los ejemplos 3, 4 y 5 se buscan las definiciones, analizando la estructura del HTML.

[![image.png](https://i.postimg.cc/yd0xbtW6/image.png)](https://postimg.cc/wyT9tWhn)

Cada definición viene en un `<dd>` o en una lista definida. Guardamos cada definición.

```javascript
// Parseamos la respuesta
const html = await data.parse.text["*"];
const dom = await new JSDOM(html);
const doc = await dom.window.document;

doc.querySelectorAll("style, script").forEach(el => el.remove()); // Quitamos style y script del documento

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
}); // Quitamos las clases no deseadas en el cuerpo del elemento.

const dd = doc.querySelectorAll("dd"); // Guardamos los nodos tipo dd, donde generalmente están las definiciones (aunque puede haber otra información)

// Parseamos y comprobamos que sean nodos con texto de longitud aceptable, además de otras verificaciones.

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
    definiciones.push(texto); // Guardamos la definición
  }
}
```

Y averiguamos si tiene etimología.

```javascript
const etiquetas = doc.querySelectorAll("p, li, dd, dt"); // Se buscan los elementos donde podría estar la etimología

const regexBase = new RegExp(`del\\s+${palabraClave}\\s+(.+?)([.,;]|<\\/|$)`, "i"); // Se genera la expresión regular para evaluar el contenido

// Recorremos el contenido
etiquetas.forEach(el => {
  const rawHTML = el.innerHTML;
  const matchHTML = rawHTML.match(regexBase);

  if (matchHTML) {
    const domFrag = new JSDOM(`<div>${matchHTML[1]}</div>`);
    const textoLimpio = domFrag.window.document.body.textContent.trim();
    resultados.push(textoLimpio);
  }
});

// Guardamos todo separando cada definición con |

const palabrasClave = resultados.join(" | ");

return palabrasClave; // También se puede retornar directamente

...

const latinResult = await extraerOrigenDesdeHTML(doc);
```

De ahí mejoramos y solo guardamos aquellas definiciones que tienen sentido.

```javascript
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
  text: palabra,
  definition: definicionesTexto,
  latin: latinResult
};
```

Ya casi al final del código, guardamos las palabras que se obtuvieron correctamente en un archivo `.txt`, llamado en este caso `palabras.txt`.

```javascript
// Si el proceso de obtención es correcto, se guarda en el array

if (info) {
  resultados.push(info);
}
await delay(50); // Para no saturar el servidor con peticiones
...

await guardarPalabrasEnArchivo(resultados); // Le pasamos el array
// Recorre el array y lo guarda en palabras.txt
```

Luego recorremos el `.txt` e insertamos las palabras en el back end.

```javascript
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
      { text: word, definition, origin, latin },
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

async function insertarPalabrasBackEnd() {
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

...

await insertarPalabrasBackEnd();
```

## ¿Cómo ejecutarlo en local?

Primero debes tener el back end y el front end de games ejecutándose. Aunque en este caso, solo con el back ya funcionaría el consumo de APIs.

Clona el repositorio:

```bash
https://github.com/JoakinGC/api-consume-back-end-games-word.git
```

Si usas `yarn`, simplemente ejecuta:

```bash
yarn install 
```

O

```bash
npm i
```

Luego crea y configura tu `.env` basado en `.env.example`:

```
TOKEN_CLERK_CLIENT="dvxxxx"
END_POINT_BACK_END="localhost:3000"
```

Finalmente, ejecuta:

```bash
node --env-file .env .\index.js
```

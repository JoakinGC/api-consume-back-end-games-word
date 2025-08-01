# API Consumption

Script creation to demonstrate the process of building and adding words to the back end.

## How does it work?

It fetches a list of 1000 random words from:
`https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt`

Then it iterates over the list, skipping words shorter than 3 characters. After that, we consume the Wiki API: `https://es.wiktionary.org`.

```javascript
if (palabra.length <= 2) continue;
...
const info = await obtenerInfoWikcionario(palabra);
```

This returns HTML (see examples 1 and 2), from which we extract and display information. In examples 3, 4, and 5 we specifically look for definitions by analyzing the HTML structure.

[![image.png](https://i.postimg.cc/yd0xbtW6/image.png)](https://postimg.cc/wyT9tWhn)

Each definition usually comes in a `<dd>` tag or a structured list. We store each valid definition.

```javascript
const html = await data.parse.text["*"];
const dom = await new JSDOM(html);
const doc = dom.window.document;

doc.querySelectorAll("style, script").forEach(el => el.remove());

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
}
```

Then we search for etymology:

```javascript
const etiquetas = doc.querySelectorAll("p, li, dd, dt");
const regexBase = new RegExp(`del\\s+${palabraClave}\\s+(.+?)([.,;]|<\\/|$)`, "i");

etiquetas.forEach(el => {
  const rawHTML = el.innerHTML;
  const matchHTML = rawHTML.match(regexBase);

  if (matchHTML) {
    const domFrag = new JSDOM(`<div>${matchHTML[1]}</div>`);
    const cleanText = domFrag.window.document.body.textContent.trim();
    resultados.push(cleanText);
  }
});

const palabrasClave = resultados.join(" | ");
return palabrasClave;

...

const latinResult = await extraerOrigenDesdeHTML(doc);
```

Then we clean and store only valid definitions:

```javascript
if (definiciones.length === 0) {
  console.log(`⚠️ No valid definitions found for "${palabra}".`);
  return null;
}

const definicionesTexto = definiciones
  .join(" | ")
  .replace(/\n/g, " ")      
  .replace(/\s+/g, " ")     
  .trim();                  

console.log(`📦 Final result for "${palabra}":`);
console.log(definicionesTexto);

return {
  text: palabra,
  definition: definicionesTexto,
  latin: latinResult
};
```

We then save the successfully processed words to a `.txt` file, in this case `palabras.txt`.

```javascript
if (info) {
  resultados.push(info);
}
await delay(50);
...

await guardarPalabrasEnArchivo(resultados);
```

Then we read the `.txt` and insert the words into the back end.

```javascript
async function insertarPalabra(line) {
  const matches = line.match(/\[(.*?)\]/g);

  if (!matches || matches.length < 3) {
    console.error(`❌ Invalid format for line: ${line}`);
    return;
  }

  const word = matches[0].replace(/^\[|\]$/g, '').trim();
  const definition = matches[1].replace(/^\[|\]$/g, '').trim();
  const latin = matches[2].replace(/^\[|\]$/g, '').trim();
  const origin = 'unknown';

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
    console.log(`✅ Inserted: ${word}`);
  } catch (err) {
    console.error(`❌ Error inserting "${word}":`, err.response?.data || err.message);
  }
}

async function insertWordsToBackEnd() {
  try {
    const data = await fs.readFile('palabras.txt', 'utf-8');
    const lines = data.split('\n').filter(l => l.trim());

    for (const line of lines) {
      await insertarPalabra(line);
    }

    console.log('✅ Processing complete.');
  } catch (error) {
    console.error('❌ Error reading file:', error.message);
  }
}

...

await insertWordsToBackEnd();
```

## How to run it locally?

You need to have the back end and the games front end running. Though in this case, only the back end is necessary for the API consumption to work.

Clone the repository:

```bash
https://github.com/JoakinGC/api-consume-back-end-games-word.git
```

If you're using `yarn`, simply run:

```bash
yarn install 
```

or

```bash
npm i
```

Then create and configure your `.env` based on `.env.example`:

```
TOKEN_CLERK_CLIENT="dvxxxx"
END_POINT_BACK_END="localhost:3000"
```

Finally, run the script:

```bash
node --env-file .env .\index.js
```
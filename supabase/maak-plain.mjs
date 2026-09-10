// Maakt supabase/schema-plain.sql uit schema.sql: dezelfde opdrachten, maar
// zonder commentaar en zonder lege regels.
//
// Waarom: als het kopieerpad naar de SQL Editor de twee streepjes van een
// commentaarregel kwijtraakt, wordt die regel ineens SQL en klapt het geheel.
// Een bestand zonder commentaar kan dat niet overkomen.
//
// Draaien na elke wijziging aan schema.sql:  node supabase/maak-plain.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const hier = path.dirname(fileURLToPath(import.meta.url));
const bron = readFileSync(path.join(hier, 'schema.sql'), 'utf8');

let uit = '';
let inString = false;
let inDollar = false;

// Regel voor regel, maar met besef van tekenreeksen: een streepjespaar
// binnen quotes of binnen $$ ... $$ is gewoon tekst en moet blijven staan.
for (const regel of bron.split('\n')) {
    let schoon = '';
    for (let i = 0; i < regel.length; i++) {
        const twee = regel.slice(i, i + 2);

        if (!inString && twee === '$$') { inDollar = !inDollar; schoon += twee; i++; continue; }
        if (!inDollar && regel[i] === "'") {
            // '' binnen een string is een ontsnapt aanhalingsteken
            if (inString && regel[i + 1] === "'") { schoon += "''"; i++; continue; }
            inString = !inString;
            schoon += "'";
            continue;
        }
        if (!inString && !inDollar && twee === '--') break;   // rest is commentaar
        schoon += regel[i];
    }

    schoon = schoon.replace(/\s+$/, '');
    if (schoon) uit += schoon + '\n';
}

const doel = path.join(hier, 'schema-plain.sql');
writeFileSync(doel, uit);
console.log(`schema-plain.sql: ${uit.split('\n').length - 1} regels`);

# Diario di bordo — problemi, decisioni e lezioni

Registro dei problemi reali incontrati costruendo questo progetto, di come sono
stati risolti e di cosa insegnano. Serve a due cose: ripassare, e avere risposte
concrete quando in colloquio arriva la domanda *"raccontami un problema che hai
dovuto risolvere"*. Un problema raccontato bene vale più di una feature in più.

Ordine cronologico. Ogni voce: cosa è successo, perché, come è stato risolto,
cosa insegna.

---

## 1. Il progetto non si lasciava creare nella sua stessa cartella

**Quando:** Task 1, primo tentativo.

**Cosa è successo.** `create-next-app` si è rifiutato di partire:

```
The directory ai-content-enricher contains files that could conflict:
  .superpowers/
```

**Perché.** Lo strumento controlla che la cartella sia "abbastanza vuota" e
confronta il contenuto con una lista chiusa di nomi considerati innocui.
`docs/` è in quella lista, `.superpowers/` (la cartella di lavoro del processo
di sviluppo) no. Non esiste nessun flag per saltare il controllo.

**Come è stato risolto.** Cartella spostata temporaneamente fuori dal repo,
scaffolding eseguito, cartella rimessa al suo posto.

**Lezione.** Molti strumenti di scaffolding pretendono una cartella quasi
vuota, e la loro definizione di "quasi" è arbitraria e non documentata. Quando
un tool rifiuta di partire, il primo posto da guardare è cosa considera un
conflitto — non cosa hai fatto di sbagliato. E la reazione giusta non è
cancellare: è spostare, perché è reversibile.

---

## 2. Il file `.env.example` spariva dal repository

**Quando:** Task 1.

**Cosa è successo.** Il file `.env.example` veniva creato correttamente, ma
`git add -A` lo ignorava: non finiva mai nei commit.

**Perché.** Il `.gitignore` generato da Next.js contiene la riga `.env*`, un
pattern che cattura anche `.env.example`.

**Come è stato risolto.** Aggiunta un'eccezione subito dopo il pattern che la
causa:

```gitignore
.env*
# eccetto il file di esempio: va condiviso e versionato
!.env.example
```

**Lezione.** In `.gitignore` il punto esclamativo nega una regola precedente, e
l'ordine conta: l'eccezione deve venire **dopo** la regola che annulla. È anche
un promemoria su una distinzione importante: `.env` contiene i segreti e non si
versiona mai; `.env.example` contiene solo i *nomi* delle variabili e va
versionato sempre, altrimenti chi clona il progetto non sa cosa configurare.

---

## 3. Un warning di Vitest e la scelta tra due modi di zittirlo

**Quando:** Task 1.

**Cosa è successo.** `npm test` funzionava ma stampava un warning del caricatore
di configurazione: il file `vitest.config.ts` usa la sintassi `import`, mentre
il progetto non dichiarava di essere un progetto a moduli ES.

**Perché.** Node ha due sistemi di moduli convissuti per anni: CommonJS
(`require`) ed ES Modules (`import`). Un file `.ts`/`.js` viene interpretato in
un modo o nell'altro a seconda del campo `"type"` nel `package.json`.

**Come è stato risolto.** Aggiunto `"type": "module"` al `package.json`.
Verificato che i file di configurazione generati da Next (`next.config.ts`,
`postcss.config.mjs`, `eslint.config.mjs`) fossero già compatibili, e che
`npm run build` continuasse a funzionare.

**Il compromesso, che è la parte interessante.** In review è emersa
un'alternativa più chirurgica: rinominare `vitest.config.ts` in
`vitest.config.mts`, che dichiara "questo singolo file è ESM" senza cambiare la
semantica dell'intero progetto. La soluzione adottata è più larga: da ora ogni
file `.js` del progetto è ESM, quindi un futuro script scritto con `require()`
andrà rinominato `.cjs`.

**Lezione.** Un warning si può quasi sempre zittire in più modi, e la differenza
tra loro è il *raggio d'azione*. La domanda giusta non è "come lo faccio
sparire", è "quanto ampia è la modifica rispetto al problema che risolve". Qui è
stata accettata la soluzione larga dopo aver verificato che non rompesse nulla —
ma la scelta va conosciuta, non subita.

---

## 4. Un test che sarebbe stato verde senza eseguire niente

**Quando:** scansione del piano, prima di scrivere una riga di codice.

**Cosa è successo.** Il piano prevedeva questo comando per lanciare il test di
contratto (l'unico che chiama davvero l'API):

```
vitest run tests/gemini.contract.test.ts --exclude ''
```

L'idea era: la configurazione esclude i file `*.contract.test.ts` dalla suite
normale, quindi per lanciarli serve annullare quell'esclusione passando una
stringa vuota.

**Perché era sbagliato.** Passare una stringa vuota a `--exclude` non sovrascrive
in modo affidabile la configurazione. Il rischio concreto: il comando termina
con successo **senza aver eseguito alcun test**, e l'output sembra quello di un
successo.

**Come è stato risolto.** Sostituito con un'esclusione esplicita e innocua:

```
vitest run --exclude "node_modules/**" tests/gemini.contract.test.ts
```

**Lezione.** Questa è la categoria di bug più insidiosa di tutte: **un test che
non fallisce perché non gira**. Dà la stessa sensazione di sicurezza di un test
che passa, senza verificare nulla. Ogni volta che si scrive un comando di test
con filtri o esclusioni, la prima verifica da fare è che il numero di test
eseguiti sia quello atteso — non che il comando esca con successo.

---

## 5. L'identità sbagliata nei commit

**Quando:** setup del repository.

**Cosa è successo.** Il `git config --global` della macchina era impostato
sull'indirizzo email aziendale. Il primo commit di un progetto personale
destinato al GitHub personale sarebbe stato firmato con quello.

**Come è stato risolto.** Impostato l'indirizzo personale a livello di
repository (`git config user.email`, senza `--global`), prima del primo commit.
Il globale è stato lasciato invariato di proposito: cambiarlo avrebbe fatto
firmare con l'indirizzo personale anche i repository di lavoro sulla stessa
macchina.

**Lezione.** Git ha una configurazione a livelli: sistema, utente (`--global`),
repository. Il livello più specifico vince. Su una macchina che ospita sia
progetti di lavoro sia progetti personali, l'identità va impostata **per
repository**, non globalmente. E va fatto **prima** del primo commit: correggere
l'autore dopo significa riscrivere la storia con `git rebase` o
`git filter-branch`, e se il repo è già stato pubblicato diventa una rogna vera.

---

## 6. Costringere l'AI a rispondere in un formato preciso

**Quando:** Task 2.

**Cosa è successo.** Lo schema dei dati è definito una volta sola con Zod, ma va
mandato anche al modello per vincolarne la risposta. Zod sa convertirsi in JSON
Schema — solo che Gemini accetta soltanto un sottoinsieme di JSON Schema
(`type`, `properties`, `items`, `enum`, `required`) e la conversione automatica
produce anche altre chiavi (`$schema`, `pattern`, `additionalProperties`).

**Come è stato risolto.** Una funzione che parte dalla conversione automatica e
tiene solo le chiavi ammesse, più due test che verificano il risultato: uno che
tutte le categorie ammesse compaiano nello schema, uno che le chiavi non
supportate non ci siano.

**Lezione.** La regola in gioco è **una sola fonte di verità**: lo schema si
scrive in un posto solo, tutto il resto si deriva. L'alternativa — mantenere a
mano due definizioni allineate — funziona finché qualcuno aggiunge un campo in
una sola delle due, e quel giorno il bug è silenzioso. Vale anche il rovescio:
il secondo test è più importante del primo, perché verifica un'**assenza**, e le
assenze sono ciò che nessuno controlla mai a occhio.

---

## 7. Un difetto che oggi non esiste, ma esisterà

**Quando:** Task 2, in revisione del codice — non durante lo sviluppo.

**Cosa è emerso.** Il filtro che adatta lo schema Zod al formato accettato da
Gemini tiene solo cinque chiavi: `type`, `properties`, `items`, `enum`,
`required`. Tutto il resto viene scartato.

Oggi funziona perfettamente, perché tutti i campi della bozza sono stringhe,
array o enum semplici. Ma se un giorno un campo diventasse **opzionale**
(`.optional()`), **annullabile** (`.nullable()`) o un'**unione di tipi**
(`z.union(...)`), la conversione automatica produrrebbe chiavi di composizione
come `anyOf`. Il filtro non le conosce, quindi le butterebbe via — e il
sottoschema di quel campo si ridurrebbe a `{}`, cioè "nessuna informazione sul
tipo".

**Perché è insidioso.** Non esploderebbe niente. Nessun errore, nessuna
eccezione: semplicemente Gemini riceverebbe uno schema che non dice più nulla su
quel campo, e la qualità delle risposte peggiorerebbe in modo silenzioso. Il
sintomo apparirebbe lontano dalla causa, ed è la classe di bug più costosa da
diagnosticare.

**Come è stato gestito.** Non è stato corretto adesso, di proposito: il ramo di
codice non è raggiungibile con lo schema attuale, e scrivere difese per casi che
non esistono è esattamente il tipo di lavoro che il progetto ha deciso di non
fare (YAGNI). È stato invece **annotato**, con la condizione precisa che lo
riattiverebbe: "se un campo diventa opzionale o nullable, questo filtro va
esteso".

**Lezione.** Ci sono tre modi di trattare un difetto latente: correggerlo subito
(spesso spreco), ignorarlo (rischio silenzioso), o **registrarlo insieme alla
condizione che lo rende reale**. Il terzo è quasi sempre il migliore, e il pezzo
che la gente dimentica è proprio la condizione: senza quella, la nota diventa
rumore e nessuno saprà mai quando è il momento di agire.

Vale anche la pena notare **come** è saltato fuori: non scrivendo il codice, ma
rileggendolo con l'obiettivo esplicito di chiedersi *"in quali condizioni questo
smetterebbe di funzionare?"*. È una domanda diversa da *"funziona?"*, e trova
cose diverse.

---

## 8. Il prompt e lo schema dicevano due cose diverse

**Quando:** Task 3, in revisione.

**Cosa è emerso.** Il prompt istruisce il modello così: *"Genera da 3 a 6 tag,
tutti in minuscolo, senza cancelletto."* Lo schema Zod, però, impone anche due
regole che il prompt non nomina: ogni tag deve essere lungo da 2 a 20 caratteri,
e può contenere solo `[a-z0-9 -]`.

Un modello che obbedisce alla lettera al prompt può quindi produrre `"s"` e
`"m"` come tag di taglia, oppure `"città"` e `"perché"`. Tutti perfettamente
conformi a quello che gli è stato chiesto. Tutti rifiutati dalla validazione.

**Perché è grave più di quanto sembri.** L'errore non sarebbe apparso qui.
Sarebbe apparso nel modulo di arricchimento, sotto forma di un fallimento di
validazione che fa scattare un tentativo di correzione, e in alcuni casi un
fallimento definitivo dopo il retry. Chi avesse indagato avrebbe guardato la
logica di retry, il modello, la rete — e la causa vera sarebbe stata una riga di
testo in un altro file. **Sintomo e causa a due moduli di distanza.**

**La parte interessante: dove stava davvero il difetto.** La revisione lo aveva
classificato come "il prompt è incompleto, va allineato allo schema". Rileggendo
la specifica, però, è emerso che il documento di design prescrive per i tag solo
*"minuscoli, 2–20 caratteri"*. Il vincolo `[a-z0-9 -]` non veniva dalla
specifica: era stato aggiunto scrivendo il piano. E in un progetto i cui
contenuti sono in italiano, **una regola che rifiuta le lettere accentate è
sbagliata**: `"città"` è un tag legittimo, non un errore da bloccare.

**Come è stato risolto.** Su entrambi i lati:

- la regex dello schema è stata estesa alle lettere accentate minuscole;
- è stato aggiunto un test che verifica che un tag accentato venga accettato;
- il test che rifiuta i tag maiuscoli è rimasto, come garanzia che la regola non
  sia diventata troppo permissiva;
- il prompt ora dichiara i vincoli veri, lunghezza compresa.

**Lezione, doppia.** La prima: quando due parti del sistema descrivono la stessa
regola, prima o poi divergono, e la divergenza si manifesta lontano dal punto in
cui è nata. Qui la regola sui tag viveva in due posti — il prompt e lo schema — e
nessun test le confrontava.

La seconda, più importante: **quando qualcosa non torna, risalire alla fonte
prima di correggere.** La correzione ovvia era allineare il prompt allo schema.
Sarebbe stata sbagliata: avrebbe reso definitivo un vincolo che nessuno aveva
chiesto e che rompeva l'italiano. La domanda giusta non era "quale dei due ha
torto", ma "chi ha deciso questa regola, e perché".

---

## 9. Il codice del piano non compilava

**Quando:** Task 4.

**Cosa è successo.** L'implementazione del provider era già scritta per intero
nel piano. Trascritta fedelmente, TypeScript l'ha rifiutata.

**Perché.** Nel ciclo di retry c'è una variabile che tiene l'ultimo errore
incontrato, inizializzata con il risultato di una funzione e riassegnata più
volte dentro il ciclo. TypeScript inferisce il tipo di una variabile dal valore
con cui la inizializzi: da un oggetto con campi letterali deduce un tipo molto
stretto — non "un errore qualsiasi", ma "esattamente quel tipo di errore". Le
riassegnazioni successive, con errori di tipo diverso, non ci entravano più.

**Come è stato risolto.** Dichiarando esplicitamente il tipo di ritorno delle
funzioni che producono errori, invece di lasciarlo indovinare. Due righe, logica
invariata.

**Il controllo che non andava saltato.** Un'annotazione di tipo fatta male può
allargare un tipo *troppo*, e in questo caso specifico avrebbe potuto alterare il
campo che dice se un errore è ritentabile — cioè cambiare la politica di retry
senza che nessun test se ne accorgesse, perché i test verificano il
comportamento, non le annotazioni. Per questo la verifica richiesta in revisione
non è stata "il codice compila?", ma "l'annotazione ha cambiato i valori da cui
dipende la logica?".

**Lezione.** L'inferenza di tipo è comoda finché una variabile ha un solo valore.
Quando una variabile deve contenere *una famiglia* di valori, il tipo va
dichiarato, non dedotto. E vale una nota di metodo: **un piano scritto bene non
garantisce codice che compila.** Il codice sulla carta è un'ipotesi finché non
passa dal compilatore.

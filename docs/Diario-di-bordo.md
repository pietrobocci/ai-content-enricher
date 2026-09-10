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

---

## 10. Un commit si è portato via un file che non c'entrava niente

**Quando:** durante la correzione del Task 3.

**Cosa è successo.** Il commit di correzione, il cui messaggio parla solo
dell'allineamento tra prompt e schema, conteneva anche 42 righe di modifiche a
`docs/Diario-di-bordo.md` — un file che con quella correzione non c'entra nulla.

**Perché.** Il file era stato modificato ma non committato: stava nel working
tree, in attesa. Quando la correzione è stata fatta e committata, il comando di
commit ha raccolto anche quella modifica pendente, perché era lì.

**Perché è un problema, anche se il contenuto era innocuo.** Un commit dovrebbe
essere **un'unità di senso**: una cosa sola, descritta dal suo messaggio.
Quando ne contiene due, si perde tutto quello che la storia di git serve a fare.
Se domani quella correzione va annullata con un `git revert`, sparisce anche la
documentazione. Se qualcuno cerca *quando* è stata introdotta una riga di
documentazione, la trova dentro un commit che parla di tag e accenti. E in una
code review, chi legge il diff deve chiedersi perché la modifica al prompt tocchi
anche un file di documentazione — una domanda che non doveva nemmeno nascere.

**Come è stato risolto.** Regola di sequenza: non lasciare mai modifiche non
committate nel working tree mentre qualcun altro sta lavorando sullo stesso
repository. O si committano prima, o si aspetta.

**Lezione.** In git, `git add -A` e `git commit -a` fotografano *tutto quello che
trovano*, non "quello che stavi facendo tu" — git non ha modo di saperlo.
Elencare i file esplicitamente in `git add` è più noioso e più corretto. E vale
la regola generale: un working tree condiviso è uno stato condiviso, con tutti i
problemi degli stati condivisi. Il fatto che i file toccati fossero diversi non
bastava: **l'area di staging è comunque una sola.**

---

## 11. La libreria era cambiata di versione maggiore

**Quando:** Task 7, subito dopo l'installazione.

**Cosa è successo.** Il piano descriveva come configurare Prisma nel dettaglio,
riga per riga. `npm install prisma` ha installato la versione **7**, e quasi
tutte quelle righe erano già superate:

| Nel piano | In Prisma 7 |
|---|---|
| `provider = "prisma-client-js"` | `provider = "prisma-client"`, con `output` obbligatorio |
| Client importato da `@prisma/client` | Client generato in una cartella del progetto |
| `url` dentro il blocco `datasource` | `url` in un file di configurazione separato |
| Nessun file di configurazione | `prisma7.config.ts` alla radice |

**Perché succede.** Un piano scritto oggi descrive le librerie come sono oggi.
Un `^` in `package.json` significa "prendi l'ultima compatibile", e le versioni
maggiori cambiano le regole apposta. Tra la scrittura di un piano e la sua
esecuzione può passare abbastanza tempo perché il mondo si sposti.

**Come è stato gestito.** Le istruzioni date a chi implementava contenevano già
una clausola per questo caso: *"se la CLI rifiuta la sintassi del piano, segui
quello che dice la CLI, tieni la modifica più piccola possibile, e documenta cosa
hai cambiato e perché — non combattere con lo strumento"*. Quindi lo scarto non
è diventato un blocco: è diventato una nota.

**Lezione, in due parti.** La prima riguarda le versioni: fissare le versioni
(`npm ci`, versioni esatte invece di `^`) rende un progetto riproducibile, e
quando un tutorial o un piano "non funziona più" la causa è quasi sempre questa.
Vale la pena verificare la versione installata *prima* di dare la colpa al
proprio codice.

La seconda riguarda come si scrivono le istruzioni: un piano che pretende
obbedienza cieca si rompe al primo scostamento dalla realtà. Un piano che dice
*"in questo punto la realtà potrebbe essere diversa: ecco come decidere"* regge.
La differenza non è nella precisione del piano — è nel fatto che preveda i punti
in cui sarà sbagliato.

---

## 12. Quattro sorprese di una libreria nuova, e come si scoprono

**Quando:** Task 7, l'implementazione vera del database.

La voce 11 raccontava la scoperta che Prisma era passato alla versione 7. Questa
racconta cosa è successo scrivendo il codice, perché ogni singolo scarto insegna
qualcosa di diverso.

### Il client generato non aveva una porta d'ingresso

Prisma genera il codice del client in una cartella del progetto. Di solito
esiste un file `index` che dice "importa da qui". In Prisma 7 quella cartella
non ha né `index.ts` né `package.json`: il percorso giusto è direttamente
`client.ts`, e a dirlo è un commento **dentro il file stesso**.

*Lezione:* quando un import non si risolve, aprire la cartella generata e
guardare cosa c'è dentro batte qualunque tentativo a memoria. Il codice generato
spesso si documenta da solo, in un commento che nessuno legge.

### Il file di configurazione non configurava tutto

`prisma7.config.ts` contiene l'indirizzo del database — ma serve **solo agli
strumenti da riga di comando**. Il client che gira dentro l'applicazione non lo
legge, e in Prisma 7 pretende un "driver adapter" esplicito: un pacchetto
separato che sa parlare con SQLite.

*Lezione:* "c'è un file di configurazione" non significa "tutto legge quel
file". Vale la pena chiedersi *chi* legge una configurazione, non solo cosa
contiene. Qui i lettori erano due, con bisogni diversi.

### Un'opzione della riga di comando non esisteva più

Il comando previsto dal piano usava `--skip-generate`. In Prisma 7 quel flag è
stato rimosso, e il comando fallisce.

*Lezione:* le opzioni della riga di comando spariscono come le funzioni. Quando
un comando copiato da una guida non parte, leggere l'errore prima di sospettare
il proprio ambiente.

### I percorsi relativi partivano da un posto inatteso

Questo è il più insidioso dei quattro. Il database di sviluppo e quello di test
sono due file distinti, e i test devono usare **solo** il secondo. I percorsi
erano scritti come `file:./dev.db` e `file:./test.db`, cioè relativi — e la
domanda è: relativi a cosa?

La risposta si è rivelata: **alla cartella dove sta il file di configurazione**,
la radice del progetto, non alla cartella dello schema come si sarebbe potuto
supporre. Con la supposizione sbagliata i due database sarebbero finiti in
posizioni diverse da quelle attese, e i test avrebbero potuto scrivere nel
database di sviluppo credendo di usarne un altro.

Non è stato dedotto: è stato **verificato guardando dove il file compariva
davvero** dopo il primo comando. Poi tutti i percorsi sono stati resi espliciti
(`file:./prisma/dev.db`, `file:./prisma/test.db`), e la separazione è stata
provata lanciando la suite due volte di fila e confrontando l'impronta MD5 del
database di sviluppo prima e dopo: invariata.

*Lezione, la più importante di tutta la voce:* un percorso relativo è ambiguo
finché non sai rispetto a **cosa** è relativo, e la risposta dipende da chi lo
interpreta — la shell, un file di configurazione, un modulo. Quando la
differenza tra due ipotesi è "i test cancellano i dati veri", non si suppone: si
guarda. E si verifica con una misura, non con un'impressione.

---

## 13. La correzione della correzione

**Quando:** Task 12, l'ultimo.

Questa voce è il seguito della numero 4, e insieme dicono più di quanto dica
ciascuna da sola.

**Il ripasso.** Il piano prevedeva questo comando per lanciare il test di
contratto, l'unico che chiama davvero l'API:

```
vitest run tests/gemini.contract.test.ts --exclude ''
```

L'idea era annullare, con una stringa vuota, l'esclusione dei file `*.contract.test.ts`
configurata per la suite normale. Il difetto — trovato leggendo, prima di
scrivere codice — era che una stringa vuota non sovrascrive in modo affidabile
la configurazione: il comando poteva uscire con successo **senza eseguire nulla**.

La correzione decisa allora era passare un'esclusione esplicita e innocua:

```
vitest run --exclude "node_modules/**" tests/gemini.contract.test.ts
```

**Cosa è successo davvero.** Eseguendolo, il risultato è stato
`No test files found`. La correzione aveva lo stesso identico difetto
dell'originale.

**Perché.** Vitest **non sostituisce** l'esclusione della configurazione con
quella passata da riga di comando: le **unisce**. Qualunque cosa si passi a
`--exclude`, l'esclusione dei file di contratto resta attiva, e il file
richiesto esplicitamente viene comunque scartato. Il comando termina con
successo perché non ha nulla da fallire.

**Come è stato risolto.** Con un file di configurazione separato per il test di
contratto, che non contiene quell'esclusione. Il comando ora raccoglie davvero
il file — e infatti **fallisce**, perché manca la chiave API. Quel fallimento è
la prova che funziona.

**Le lezioni, e sono tre.**

La prima: **una diagnosi corretta non garantisce una cura corretta.** Il difetto
era stato individuato bene e descritto bene. La correzione era comunque
sbagliata, perché si basava su un'ipotesi non verificata su come lo strumento
tratta le opzioni da riga di comando.

La seconda: **il comportamento di uno strumento va verificato, non dedotto.**
"Sovrascrive" e "unisce" sono due comportamenti plausibili, la documentazione non
lo urla, e la differenza tra i due qui era tutto.

La terza, la più utile: **il modo di verificare un test è guardare quanti test ha
eseguito.** Non se il comando è uscito con successo. In questo caso specifico la
verifica era ancora più netta: il test *doveva fallire*, perché la chiave manca —
e un fallimento per il motivo giusto vale più di un successo che non significa
niente. Un comando verde che ha eseguito zero test è il modo più elegante di
mentire a sé stessi.

---

## 14. Perché serviva una revisione finale, e cosa ha trovato solo lei

**Quando:** alla fine, a progetto completo.

Ogni task era stato revisionato singolarmente e approvato. Poi una revisione
sull'intero progetto ha trovato nove problemi in più. Non perché le prime
fossero superficiali: perché guardavano un'altra cosa.

**Il difetto che nessuna revisione per-task poteva vedere.** La specifica
dice che, di fronte a un errore di quota (429), bisogna rispettare **l'attesa
indicata dal server**. Il piano, scrivendo il codice del provider, aveva perso
quella riga: prevedeva un'attesa a crescita esponenziale e basta. Ogni revisione
per-task confrontava il codice **col piano**, e col piano il codice era perfetto.
Solo la revisione finale, che legge la *specifica* come autorità, ha visto il
requisito mancante.

*Lezione:* quando si controlla un lavoro contro un documento intermedio, si
eredita ogni errore di quel documento. Serve almeno un controllo che risalga
alla fonte.

**Il difetto che stava nello spazio tra due task.** Il file degli stili globali,
generato al primo task, conteneva ancora un blocco che rende lo sfondo quasi nero
su un computer in tema scuro. Le pagine, scritte nei task 10 e 11, usano colori
pensati per fondo chiaro. Ognuno dei tre file, preso da solo, è corretto.
Insieme, su una macchina in tema scuro, producono testo grigio su nero: la prima
cosa che vedrebbe qualcuno aprendo il progetto.

*Lezione:* i difetti di integrazione non stanno **dentro** i pezzi, stanno
**tra** i pezzi. Nessuna revisione che guardi un pezzo alla volta li può trovare,
per quanto sia attenta.

**Il difetto nascosto da un'aspettativa.** Il test di contratto non riusciva a
leggere la chiave API dal file `.env`, perché lo strumento di test espande quelle
variabili contro una *copia* dell'ambiente e non le riscrive mai in quello vero.
Il risultato era un fallimento con scritto "chiave non impostata". Ed era
esattamente il messaggio che ci si aspettava di vedere, non avendo una chiave —
quindi era stato letto come conferma che tutto funzionasse.

*Lezione, la più sottile delle tre:* **un'aspettativa può nascondere un difetto
che ha lo stesso aspetto.** Il fallimento atteso e il fallimento reale avevano lo
stesso testo. L'unico modo di distinguerli era chiedersi *perché* stesse
fallendo, non se il fallimento fosse quello previsto.

**Nota sul metodo.** La revisione finale non ha dedotto quasi nulla: ha eseguito
il filtro dello schema contro la libreria vera per vedere cosa produce, ha letto
il codice sorgente dello strumento di test per stabilire se le variabili
d'ambiente arrivano davvero, ha confrontato le dipendenze dichiarate con quelle
installate in modo programmatico. Ogni volta che una risposta era deducibile ma
verificabile, l'ha verificata. È il motivo per cui ha trovato cose che tutti gli
altri passaggi avevano lasciato lì.

---

## 15. Il modello c'era nell'elenco, ma non era più utilizzabile

**Quando:** la prima prova con la chiave API vera, a progetto già pubblicato.

**Cosa è successo.** Il test di contratto — l'unico che chiama davvero l'API —
è fallito con **404**. Un 404, non un 401: quindi non un problema di
autenticazione, ma "questa cosa non esiste".

**La diagnosi, passo per passo.** Invece di indovinare, tre domande in
sequenza, ognuna con una risposta netta:

1. *La chiave è valida?* Richiesta all'elenco dei modelli: **HTTP 200**. Sì.
2. *Il modello esiste?* Nell'elenco appariva `gemini-2.5-flash`, con tanto di
   descrizione e limiti di token. Sembrava di sì.
3. *Allora perché 404?* Riproducendo la chiamata vera, la risposta diceva
   tutto:

```
This model models/gemini-2.5-flash is no longer available to new users.
Please update your code to use models/gemini-3.6-flash
```

**Il punto interessante.** Il modello **compariva ancora nell'elenco** ma non
era utilizzabile da un account nuovo. Le due domande *"esiste?"* e *"posso
usarlo io?"* hanno risposte diverse, e l'elenco risponde solo alla prima. Una
verifica basata sull'elenco — che era esattamente quella prevista dal piano —
avrebbe detto "tutto a posto" e il problema sarebbe rimasto.

**Come è stato risolto.** Costante `MODELLO_DEFAULT` aggiornata a
`gemini-3.6-flash`, verificata con una chiamata reale **completa di schema
strutturato**, non solo con un ping: la risposta è arrivata nella forma esatta
attesa dal contratto.

**Lezione.** Un servizio esterno può essere elencato, documentato e comunque
inaccessibile a te. L'unica verifica che conta è **fare la chiamata che farà il
programma**, con gli stessi parametri. È anche il motivo per cui esiste il test
di contratto: tutti gli altri 54 test erano verdi, e sarebbero rimasti verdi
per sempre, perché nessuno di loro tocca la rete. Quel singolo test escluso
dalla suite è l'unico che poteva accorgersene.

**Una nota di misura, per il futuro.** La chiamata reale su una foto vera ha
impiegato **circa 27 secondi**. È molto per un'operazione con una persona che
aspetta davanti allo schermo, e non era prevedibile dai test offline, dove il
provider finto risponde all'istante. Se il progetto crescesse, è il primo posto
dove mettere una barra di avanzamento o un modello più veloce.

import { Injectable, Pipe, PipeTransform, signal } from '@angular/core';

export type Lang = 'en' | 'af' | 'zu' | 'xh';
export const LANGS: { code: Lang; label: string; speech: string }[] = [
  { code: 'en', label: 'English', speech: 'en-ZA' },
  { code: 'af', label: 'Afrikaans', speech: 'af-ZA' },
  { code: 'zu', label: 'isiZulu', speech: 'zu-ZA' },
  { code: 'xh', label: 'isiXhosa', speech: 'xh-ZA' },
];

/**
 * One row per string: [English, Afrikaans, isiZulu, isiXhosa].
 * NOTE: the Afrikaans, isiZulu and isiXhosa text must be reviewed by native speakers before launch,
 * starting with the sos.* and alert.* rows. Empty cells fall back to English.
 */
const T: Record<string, [string, string, string, string]> = {
  'nav.overview': ['Overview', 'Oorsig', 'Isifinyezo', 'Isishwankathelo'],
  'nav.map': ['Map', 'Kaart', 'Imephu', 'Imephu'],
  'nav.route': ['Safe route', 'Veilige roete', 'Indlela ephephile', 'Indlela ekhuselekileyo'],
  'nav.live': ['Live', 'Regstreeks', 'Bukhoma', 'Ngoku'],
  'nav.friends': ['Friends', 'Vriende', 'Abangane', 'Abahlobo'],
  'nav.myReports': ['My reports', 'My verslae', 'Imibiko yami', 'Iingxelo zam'],
  'nav.review': ['Review', 'Hersien', 'Buyekeza', 'Hlola'],
  'nav.report': ['Report incident', 'Rapporteer voorval', 'Bika isehlakalo', 'Xela isiganeko'],
  'nav.reportShort': ['Report', 'Rapporteer', 'Bika', 'Xela'],

  'common.offline': ["You're offline. Showing saved data. SOS will offer to text your friends.",
    'Jy is vanlyn. Gestoorde data word gewys. SOS sal aanbied om jou vriende te SMS.',
    'Awuxhunyiwe ku-inthanethi. Kuboniswa idatha egciniwe. I-SOS izokunikeza ukuthumela abangane i-SMS.',
    'Awuqhagamshelwanga kwi-intanethi. Kuboniswa idatha egciniweyo. I-SOS iya kunika ukuthumela abahlobo i-SMS.'],
  'common.cancel': ['Cancel', 'Kanselleer', 'Khansela', 'Rhoxisa'],

  'live.emergencyActive': ['Emergency alert active. Friends can see where you are.', 'Noodwaarskuwing aktief. Vriende kan sien waar jy is.',
    'Isexwayiso esiphuthumayo siyasebenza. Abangane bayabona ukuthi ukuphi.', 'Isilumkiso sikaxakeka siyasebenza. Abahlobo bayabona ukuba uphi.'],
  'live.sharing': ['Sharing your location', 'Deel jou ligging', 'Wabelana ngendawo okuyo', 'Wabelana ngendawo okuyo'],
  'live.stop': ['Stop', 'Stop', 'Misa', 'Yeka'],
  'live.arrived': ["I've arrived", 'Ek het aangekom', 'Sengifikile', 'Ndifikile'],
  'live.view': ['View', 'Bekyk', 'Buka', 'Jonga'],

  'sos.title': ['Emergency SOS', 'Nood-SOS', 'I-SOS yesimo esiphuthumayo', 'I-SOS kaxakeka'],
  'sos.intro': ['Hold the button for 3 seconds. Your friends get an urgent alert with your live location.',
    "Hou die knoppie 3 sekondes lank in. Jou vriende kry 'n dringende waarskuwing met jou regstreekse ligging.",
    'Bamba inkinobho imizuzwana emi-3. Abangane bakho bazothola isexwayiso esiphuthumayo nendawo okuyo manje.',
    'Bamba iqhosha imizuzwana emi-3. Abahlobo bakho baya kufumana isilumkiso esingxamisekileyo nendawo okuyo ngoku.'],
  'sos.hold': ['Hold for SOS', 'Hou in vir SOS', 'Bamba uthumele i-SOS', 'Bamba uthumele i-SOS'],
  'sos.keepHolding': ['Keep holding', 'Hou aan', 'Qhubeka ubambe', 'Qhubeka ubambe'],
  'sos.sending': ['Sending…', 'Stuur tans…', 'Iyathumela…', 'Iyathumela…'],
  'sos.letGo': ['Let go to cancel.', 'Los om te kanselleer.', 'Yekela ukuze ukhansele.', 'Yeka ukuze urhoxise.'],
  'sos.sent': ['Alert sent', 'Waarskuwing gestuur', 'Isexwayiso sithunyelwe', 'Isilumkiso sithunyelwe'],
  'sos.sentText': ['Your friends have been notified and can see where you are. Keep CrimeSpot open so your location keeps updating.',
    'Jou vriende is in kennis gestel en kan sien waar jy is. Hou CrimeSpot oop sodat jou ligging aanhou opdateer.',
    'Abangane bakho bazisiwe futhi bayakwazi ukubona ukuthi ukuphi. Gcina i-CrimeSpot ivuliwe ukuze indawo yakho iqhubeke ibuyekezwa.',
    'Abahlobo bakho baziswe kwaye bayakwazi ukubona ukuba uphi. Gcina i-CrimeSpot ivuliwe ukuze indawo yakho ihlale ihlaziywa.'],
  'sos.safe': ["I'm safe. End the alert.", 'Ek is veilig. Beëindig die waarskuwing.', 'Ngiphephile. Qeda isexwayiso.', 'Ndikhuselekile. Phelisa isilumkiso.'],
  'sos.confirmSafe': ['End the alert and let your friends know you are safe?', 'Beëindig die waarskuwing en laat jou vriende weet jy is veilig?',
    'Qeda isexwayiso futhi wazise abangane bakho ukuthi uphephile?', 'Phelisa isilumkiso uze wazise abahlobo bakho ukuba ukhuselekile?'],
  'sos.police': ['Police (SAPS)', 'Polisie (SAPD)', 'Amaphoyisa (SAPS)', 'Amapolisa (SAPS)'],
  'sos.cell': ['From any cellphone', 'Vanaf enige selfoon', 'Kunoma iyiphi iselula', 'Kuyo nayiphi na iselfowuni'],
  'sos.ambulance': ['Ambulance', 'Ambulans', 'I-ambulensi', 'I-ambulensi'],
  'sos.noFriends': ["You haven't added any friends yet, so an alert would reach no one. Call 10111 if you're in danger now.",
    "Jy het nog geen vriende bygevoeg nie, so 'n waarskuwing sal niemand bereik nie. Bel 10111 as jy nou in gevaar is.",
    'Awukabengezi abangane, ngakho isexwayiso ngeke sifinyelele muntu. Shayela u-10111 uma usengozini manje.',
    'Akukabongezi bahlobo, ngoko isilumkiso asizukufikelela mntu. Tsalela u-10111 ukuba usengozini ngoku.'],
  'sos.addFriends': ['Add friends', 'Voeg vriende by', 'Engeza abangane', 'Yongeza abahlobo'],
  'sos.message': ['Add a short message (optional)', "Voeg 'n kort boodskap by (opsioneel)", 'Engeza umlayezo omfushane (akuphoqelekile)', 'Yongeza umyalezo omfutshane (akunyanzelekanga)'],
  'sos.failed': ["The alert didn't go through. Text your friends your location instead:", 'Die waarskuwing het nie deurgegaan nie. SMS eerder jou ligging aan jou vriende:',
    'Isexwayiso asidlulanga. Thumelela abangane bakho i-SMS ngendawo okuyo:', 'Isilumkiso asihambanga. Thumela abahlobo bakho i-SMS ngendawo okuyo:'],
  'sos.sendSms': ['Send SMS to friends', 'Stuur SMS aan vriende', 'Thumela i-SMS kubangane', 'Thumela i-SMS kubahlobo'],
  'sos.fakeCall': ['Fake call', 'Kamma-oproep', 'Ikholi yokuzenzisa', 'Umnxeba wokuzenzisa'],
  'sos.fakeCallHint': ['A pretend call to help you leave', "'n Kamma-oproep om jou te help wegkom", 'Ikholi yokuzenzisa ukuze ukwazi ukuhamba', 'Umnxeba wokuzenzisa okunceda uhambe'],
  'sos.card': ['Emergency card', 'Noodkaart', 'Ikhadi lesimo esiphuthumayo', 'Ikhadi likaxakeka'],
  'sos.cardHint': ['Medical details friends see during an SOS', "Mediese besonderhede wat vriende tydens 'n SOS sien",
    'Imininingwane yezempilo ebonwa ngabangane ngesikhathi se-SOS', 'Iinkcukacha zonyango ezibonwa ngabahlobo ngexesha le-SOS'],

  'alert.needsHelp': ['{name} needs help', '{name} het hulp nodig', 'U-{name} udinga usizo', 'U-{name} ufuna uncedo'],
  'alert.isSafe': ['{name} is safe', '{name} is veilig', 'U-{name} uphephile', 'U-{name} ukhuselekile'],
  'alert.tapToSee': ['Tap to see where they are', 'Tik om te sien waar hulle is', 'Thepha ukuze ubone ukuthi ukuphi', 'Cofa ukuze ubone ukuba uphi'],
  'alert.call': ['Call {name}', 'Bel {name}', 'Shayela u-{name}', 'Tsalela u-{name}'],
  'alert.directions': ['Directions', 'Aanwysings', 'Izikhombisi-ndlela', 'Imikhombandlela'],
  'alert.callPolice': ['Call police (10111)', 'Bel die polisie (10111)', 'Shayela amaphoyisa (10111)', 'Tsalela amapolisa (10111)'],

  'card.intro': ["Friends only see this while your SOS is active. It's stored encrypted.", 'Vriende sien dit net terwyl jou SOS aktief is. Dit word geïnkripteer gestoor.',
    'Abangane bakubona lokhu kuphela uma i-SOS yakho isebenza. Kugcinwa kubethelwe.', 'Abahlobo bakubona oku kuphela xa i-SOS yakho isebenza. Kugcinwe kufihliwe.'],
  'card.bloodType': ['Blood type', 'Bloedgroep', 'Uhlobo lwegazi', 'Udidi lwegazi'],
  'card.allergies': ['Allergies', 'Allergieë', 'Ama-aleji', 'Ii-aleji'],
  'card.medications': ['Medication', 'Medikasie', 'Imithi', 'Amayeza'],
  'card.conditions': ['Medical conditions', 'Mediese toestande', 'Izimo zempilo', 'Iimeko zempilo'],
  'card.medicalAid': ['Medical aid', 'Mediese fonds', 'I-medical aid', 'I-medical aid'],
  'card.memberNo': ['Member number', 'Lidnommer', 'Inombolo yelungu', 'Inombolo yelungu'],
  'card.contact': ['Emergency contact', 'Noodkontak', 'Oxhumana naye uma kuphuthuma', 'Umntu oqhagamshelwa kaxakeka'],
  'card.contactName': ['Name', 'Naam', 'Igama', 'Igama'],
  'card.relation': ['Relationship', 'Verwantskap', 'Ubuhlobo', 'Ulwalamano'],
  'card.phone': ['Phone', 'Telefoon', 'Ifoni', 'Ifowuni'],
  'card.notes': ['Other notes', 'Ander notas', 'Amanye amanothi', 'Ezinye iinkcukacha'],
  'card.consent': ['I agree that my friends can see this information while my SOS alert is active.',
    'Ek stem in dat my vriende hierdie inligting kan sien terwyl my SOS-waarskuwing aktief is.',
    'Ngiyavuma ukuthi abangane bami bangalubona lolu lwazi ngesikhathi isexwayiso sami se-SOS sisebenza.',
    'Ndiyavuma ukuba abahlobo bam bangalubona olu lwazi ngelixa isilumkiso sam se-SOS sisebenza.'],
  'card.save': ['Save card', 'Stoor kaart', 'Londoloza ikhadi', 'Gcina ikhadi'],
  'card.delete': ['Delete card', 'Skrap kaart', 'Susa ikhadi', 'Cima ikhadi'],

  'fake.intro': ['Schedule a pretend incoming call to give yourself a reason to leave. Keep CrimeSpot open on your screen.',
    "Skeduleer 'n kamma-inkomende oproep sodat jy 'n rede het om weg te gaan. Hou CrimeSpot oop op jou skerm.",
    'Hlela ikholi yokuzenzisa engenayo ukuze ube nesizathu sokuhamba. Gcina i-CrimeSpot ivuliwe esikrinini sakho.',
    'Cwangcisa umnxeba wokuzenzisa ongenayo ukuze ube nesizathu sokuhamba. Gcina i-CrimeSpot ivuliwe kwiscreen sakho.'],
  'fake.caller': ['Caller name', 'Naam van beller', 'Igama lofonayo', 'Igama lomntu otsalayo'],
  'fake.when': ['Ring in', 'Lui oor', 'Khala ngemva kwe', 'Khala emva kwe'],
  'fake.now': ['Now', 'Nou', 'Manje', 'Ngoku'],
  'fake.start': ['Schedule call', 'Skeduleer oproep', 'Hlela ikholi', 'Cwangcisa umnxeba'],
  'fake.ringingIn': ['Ringing in {n} s', 'Lui oor {n} s', 'Izokhala ngemva kwemizuzwana engu-{n}', 'Uza kukhala emva kwemizuzwana eyi-{n}'],
  'fake.incoming': ['Incoming call', 'Inkomende oproep', 'Ikholi engenayo', 'Umnxeba ongenayo'],
  'fake.mobile': ['mobile', 'selfoon', 'iselula', 'iselfowuni'],
  'fake.accept': ['Accept', 'Antwoord', 'Phendula', 'Phendula'],
  'fake.decline': ['Decline', 'Weier', 'Yenqaba', 'Yala'],
  'fake.end': ['End call', 'Beëindig oproep', 'Qeda ikholi', 'Phelisa umnxeba'],
  'fake.script': ["Hi, where are you? I'm outside waiting for you. Please come now.", 'Hallo, waar is jy? Ek wag buite vir jou. Kom asseblief nou.',
    'Sawubona, ukuphi? Ngikulindile ngaphandle. Sicela uze manje.', 'Molo, uphi? Ndikulindile phandle. Nceda uze ngoku.'],
  'fake.note': ['The call only rings while CrimeSpot is open.', 'Die oproep lui net terwyl CrimeSpot oop is.',
    'Ikholi ikhala kuphela uma i-CrimeSpot ivuliwe.', 'Umnxeba ukhala kuphela xa i-CrimeSpot ivuliwe.'],
  'fake.defaultCaller': ['Mom', 'Ma', 'Mama', 'Mama'],

  'route.intro': ['Find a way there that avoids hotspots.', "Vind 'n roete wat brandpunte vermy.", 'Thola indlela egwema izindawo eziyingozi.', 'Fumana indlela ephepha iindawo ezinobungozi.'],
  'route.from': ['From', 'Van', 'Kusuka', 'Ukusuka'],
  'route.myLocation': ['My location', 'My ligging', 'Indawo engikuyo', 'Indawo endikuyo'],
  'route.to': ['To', 'Na', 'Kuya', 'Ukuya'],
  'route.search': ['Search a place, or tap the map', "Soek 'n plek, of tik op die kaart", 'Sesha indawo, noma uthephe imephu', 'Khangela indawo, okanye ucofe imephu'],
  'route.walk': ['Walk', 'Stap', 'Ngezinyawo', 'Ngeenyawo'],
  'route.drive': ['Drive', 'Ry', 'Ngemoto', 'Ngemoto'],
  'route.find': ['Find routes', 'Vind roetes', 'Thola izindlela', 'Fumana iindlela'],
  'route.finding': ['Finding routes…', 'Soek roetes…', 'Ithola izindlela…', 'Ifumana iindlela…'],
  'route.SAFER': ['Safer route', 'Veiliger roete', 'Indlela ephephe kakhudlwana', 'Indlela ekhuselekileyo ngakumbi'],
  'route.FASTEST': ['Fastest route', 'Vinnigste roete', 'Indlela esheshayo kakhulu', 'Eyona ndlela ikhawulezayo'],
  'route.SAFE_AND_FAST': ['Fastest, and avoids hotspots', 'Vinnigste, en vermy brandpunte', 'Ishesha kakhulu, futhi igwema izindawo eziyingozi', 'Ikhawuleza, kwaye iphepha iindawo ezinobungozi'],
  'route.passes': ['Passes {list}', 'Gaan deur {list}', 'Idlula e-{list}', 'Idlula e-{list}'],
  'route.clear': ['No hotspots on this route', 'Geen brandpunte op hierdie roete nie', 'Azikho izindawo eziyingozi kule ndlela', 'Akukho ndawo inobungozi kule ndlela'],
  'route.share': ['Share my trip with friends', 'Deel my rit met vriende', 'Yabelana ngohambo lwami nabangane', 'Yabelana ngohambo lwam nabahlobo'],
  'route.shareNote': ["Friends see you live, and are alerted if you don't check in when you arrive.",
    "Vriende sien jou regstreeks, en kry 'n waarskuwing as jy nie inteken wanneer jy aankom nie.",
    'Abangane bakubona bukhoma, futhi bayaxwayiswa uma ungazibiki lapho ufika.',
    'Abahlobo bakubona ngoku, kwaye bayalunyukiswa ukuba awuzazisi xa ufikayo.'],

  'lang.title': ['Language', 'Taal', 'Ulimi', 'Ulwimi'],
  'lang.note': ['Translations are being checked by native speakers.', 'Vertalings word deur moedertaalsprekers nagegaan.',
    'Izinguqulo zisahlolwa ngabakhuluma lezi zilimi.', 'Iinguqulelo zisahlolwa zizithethi zolwimi.'],

  'welcome.headline': ["Know what's happening on your street.", 'Weet wat in jou straat gebeur.', 'Yazi okwenzekayo emgwaqweni wakho.', 'Yazi okwenzekayo esitratweni sakho.'],
  'welcome.lede': ["Report crime, see where it's clustering, share your live location with people you trust, and alert them with one button when you're in danger.",
    'Rapporteer misdaad, sien waar dit saamtrek, deel jou regstreekse ligging met mense wat jy vertrou, en waarsku hulle met een knoppie wanneer jy in gevaar is.',
    'Bika ubugebengu, ubone lapho budlange khona, wabelane ngendawo okuyo nabantu obathembayo, futhi ubaxwayise ngenkinobho eyodwa uma usengozini.',
    'Xela ulwaphulo-mthetho, ubone apho lugxile khona, wabelane ngendawo okuyo nabantu obathembayo, uze ubalumkise ngeqhosha elinye xa usengozini.'],
  'welcome.start': ['Get started', 'Begin', 'Qala', 'Qalisa'],
  'welcome.signin': ['Sign in', 'Meld aan', 'Ngena', 'Ngena'],
  'login.google': ['Continue with Google', 'Gaan voort met Google', 'Qhubeka nge-Google', 'Qhubeka nge-Google'],
  'login.email': ['Sign in with email', 'Meld aan met e-pos', 'Ngena nge-imeyili', 'Ngena nge-imeyile'],
  'login.create': ['Create an account with email', "Skep 'n rekening met e-pos", 'Vula i-akhawunti nge-imeyili', 'Yenza iakhawunti nge-imeyile'],
  'login.back': ['← Back to home', '← Terug na tuis', '← Buyela ekhaya', '← Buyela ekhaya'],

  'nav.groups': ['Groups', 'Groepe', 'Amaqembu', 'Amaqela'],
  'common.apiDown': ["CrimeSpot's server isn't responding. If you're in danger, call 10111. SOS will offer to text your friends.",
    'CrimeSpot se bediener reageer nie. As jy in gevaar is, bel 10111. SOS sal aanbied om jou vriende te SMS.',
    'Iseva ye-CrimeSpot ayiphenduli. Uma usengozini, shayela u-10111. I-SOS izokunikeza ukuthumela abangane i-SMS.',
    'Iseva ye-CrimeSpot ayiphenduli. Ukuba usengozini, tsalela u-10111. I-SOS iya kunika ukuthumela abahlobo i-SMS.'],

  'seen.button': ['Seen it too', 'Ek het dit ook gesien', 'Nami ngikubonile', 'Nam ndikubonile'],
  'seen.count': ['{n} confirmed', '{n} bevestig', '{n} baqinisekisile', '{n} baqinisekisile'],
  'seen.trusted': ['Trusted reporter', 'Betroubare verslaggewer', 'Umbiki othembekile', 'Umxeli othembekileyo'],
  'risk.now': ['Risk now', 'Risiko nou', 'Ingozi manje', 'Umngcipheko ngoku'],
  'risk.weekends': ['mostly weekends', 'meestal naweke', 'kakhulu ngezimpelasonto', 'ikakhulu ngeempelaveki'],
  'risk.weekdays': ['mostly weekdays', 'meestal weeksdae', 'kakhulu phakathi nesonto', 'ikakhulu phakathi evekini'],

  'route.leave': ['Leaving', 'Vertrek', 'Ukuhamba', 'Ukuhamba'],
  'route.leave1h': ['In 1 hour', 'Oor 1 uur', 'Ngemva kwehora eli-1', 'Emva kweyure e-1'],
  'route.tonight': ['Tonight {t}', 'Vanaand {t}', 'Kusihlwa {t}', 'Ngokuhlwa {t}'],

  'walk.title': ['Walk with me', 'Stap saam met my', 'Hamba nami', 'Hamba nam'],
  'walk.intro': ["Ask a friend to watch over you until you arrive. If you stop moving or lose signal, they're told.",
    'Vra \'n vriend om oor jou te waak tot jy aankom. As jy ophou beweeg of sein verloor, word hulle ingelig.',
    'Cela umngane akubheke uze ufike. Uma uyeka ukunyakaza noma ulahlekelwa yisiginali, uyaziswa.',
    'Cela umhlobo akujonge ude ufike. Ukuba uyeka ukushukuma okanye ulahlekelwe ngumqondiso, uyaziswa.'],
  'walk.ask': ['Ask {name}', 'Vra {name}', 'Cela u-{name}', 'Cela u-{name}'],
  'walk.waiting': ['Waiting for {name} to accept…', 'Wag vir {name} om te aanvaar…', 'Silindele u-{name} ukuthi amukele…', 'Silindele u-{name} ukuba amkele…'],
  'walk.with': ['{name} is walking with you', '{name} stap saam met jou', 'U-{name} uhamba nawe', 'U-{name} uhamba nawe'],
  'walk.incoming': ['{name} wants you to walk with them', '{name} wil hê jy moet saam met hulle stap', 'U-{name} ufuna uhambe naye', 'U-{name} ufuna uhambe naye'],
  'walk.accept': ['Walk with them', 'Stap saam', 'Hamba naye', 'Hamba naye'],
  'walk.decline': ["Can't right now", 'Nie nou nie', 'Angikwazi manje', 'Andikwazi ngoku'],
  'walk.escorting': ["You're walking with {name}", 'Jy stap saam met {name}', 'Uhamba no-{name}', 'Uhamba no-{name}'],
  'walk.raise': ['Raise alert for {name}', 'Stuur waarskuwing vir {name}', 'Thumela isexwayiso sika-{name}', 'Thumela isilumkiso sika-{name}'],
  'walk.raiseConfirm': ['Send an emergency alert to all of {name}\'s friends?', 'Stuur \'n noodwaarskuwing aan al {name} se vriende?',
    'Thumela isexwayiso esiphuthumayo kubo bonke abangane baka-{name}?', 'Thumela isilumkiso sikaxakeka kubo bonke abahlobo baka-{name}?'],
  'walk.still': ["You haven't moved for a few minutes. {name} was told.", 'Jy het \'n paar minute nie beweeg nie. {name} is ingelig.',
    'Awunyakazanga imizuzu embalwa. U-{name} wazisiwe.', 'Akushukumanga imizuzu embalwa. U-{name} waziswe.'],
  'walk.ok': ["I'm OK", 'Ek is oukei', 'Ngiyaphila', 'Ndiphilile'],
  'walk.stillEscort': ["{name} hasn't moved for 3 minutes", '{name} het 3 minute lank nie beweeg nie', 'U-{name} akanyakazanga imizuzu emi-3', 'U-{name} akashukumanga imizuzu emi-3'],
  'walk.lostEscort': ['Lost contact with {name}', 'Kontak met {name} verloor', 'Ukuxhumana no-{name} kulahlekile', 'Unxibelelwano no-{name} lulahlekile'],
  'walk.end': ['End walk', 'Beëindig stap', 'Qeda ukuhamba', 'Phelisa ukuhamba'],

  'outage.button': ['Power out?', 'Krag af?', 'Ugesi ucimile?', 'Umbane ucimile?'],
  'outage.out': ["Power's out here", 'Die krag is hier af', 'Ugesi ucimile lapha', 'Umbane ucimile apha'],
  'outage.back': ["Power's back", 'Die krag is terug', 'Ugesi ubuyile', 'Umbane ubuyile'],
  'outage.zone': ['Power out · {n} people · since {t}', 'Krag af · {n} mense · sedert {t}', 'Ugesi ucimile · abantu abangu-{n} · kusukela ngo-{t}', 'Umbane ucimile · abantu aba-{n} · ukusukela ngo-{t}'],
  'outage.hotspot': ['Near the {name} hotspot. Stay alert.', 'Naby die {name}-brandpunt. Bly waaksaam.', 'Eduze nendawo eyingozi yase-{name}. Qaphela.', 'Kufutshane nendawo enobungozi yase-{name}. Lumka.'],
  'outage.help': ['Zones appear when 3 people nearby report an outage.', 'Sones verskyn wanneer 3 mense naby \'n onderbreking aanmeld.',
    'Izindawo ziyavela uma abantu abangu-3 abaseduze bebika ukucima kukagesi.', 'Iindawo ziyavela xa abantu aba-3 abakufutshane bexela ukucima kombane.'],

  'data.title': ['Your data', 'Jou data', 'Idatha yakho', 'Idatha yakho'],
  'data.intro': ['Download everything CrimeSpot holds about you, or delete your account.', 'Laai alles af wat CrimeSpot oor jou hou, of skrap jou rekening.',
    'Landa konke i-CrimeSpot enakho ngawe, noma ususe i-akhawunti yakho.', 'Khuphela yonke into i-CrimeSpot enayo ngawe, okanye ucime iakhawunti yakho.'],
  'data.download': ['Download my data', 'Laai my data af', 'Landa idatha yami', 'Khuphela idatha yam'],
  'data.delete': ['Delete my account', 'Skrap my rekening', 'Susa i-akhawunti yami', 'Cima iakhawunti yam'],
  'data.deleteConfirm': ['This permanently deletes your account, reports, comments, alerts and friends. Type DELETE to confirm.',
    'Dit skrap jou rekening, verslae, kommentaar, waarskuwings en vriende permanent. Tik DELETE om te bevestig.',
    'Lokhu kususa unomphela i-akhawunti yakho, imibiko, amazwana, izexwayiso nabangane. Bhala u-DELETE ukuze uqinisekise.',
    'Oku kucima ngonaphakade iakhawunti yakho, iingxelo, izimvo, izilumkiso nabahlobo. Chwetheza u-DELETE ukuqinisekisa.'],

  'groups.title': ['Groups', 'Groepe', 'Amaqembu', 'Amaqela'],
  'groups.intro': ['Neighbourhood watches, estates and community policing forums. Share alerts and keep an eye on your area together.', '', '', ''],
  'groups.create': ['Create a group', 'Skep \'n groep', 'Dala iqembu', 'Yenza iqela'],
  'groups.join': ['Join with a code', 'Sluit aan met \'n kode', 'Joyina ngekhodi', 'Joyina ngekhowudi'],
  'groups.sosShare': ['Send my SOS alerts to this group', 'Stuur my SOS-waarskuwings na hierdie groep', 'Thumela izexwayiso zami ze-SOS kuleli qembu', 'Thumela izilumkiso zam ze-SOS kweli qela'],
  'groups.sosShareNote': ['Members will see your alert, location and phone number during an SOS. Your emergency card stays friends-only.', '', '', ''],

  'crime.ROBBERY': ['Robbery', 'Roof', 'Ukuphanga', 'Ukuphanga'],
  'crime.HIJACKING': ['Hijacking', 'Kaping', 'Ukudunwa kwemoto', 'Ukuxhwilwa kwesithuthi'],
  'crime.ASSAULT': ['Assault', 'Aanranding', 'Ukuhlaselwa', 'Uhlaselo'],
  'crime.BURGLARY': ['Burglary / break-in', 'Inbraak', 'Ukugqekeza', 'Ukuqhekeza'],
  'crime.THEFT': ['Theft', 'Diefstal', 'Ukweba', 'Ubusela'],
  'crime.DRUG_RELATED': ['Drug-related', 'Dwelmverwant', 'Okuphathelene nezidakamizwa', 'Okunxulumene neziyobisi'],
  'crime.FRAUD': ['Fraud / scam', 'Bedrog', 'Ukukhwabanisa', 'Ubuqhetseba'],
  'crime.VANDALISM': ['Vandalism', 'Vandalisme', 'Ukucekela phansi impahla', 'Ukonakalisa impahla'],
  'crime.SUSPICIOUS_ACTIVITY': ['Suspicious activity', 'Verdagte aktiwiteit', 'Okusolisayo', 'Izenzo ezikrokrisayo'],
  'crime.OTHER': ['Other', 'Ander', 'Okunye', 'Okunye'],
};

const IDX: Record<Lang, number> = { en: 0, af: 1, zu: 2, xh: 3 };

function initial(): Lang {
  try {
    const saved = localStorage.getItem('crimespot.lang') as Lang | null;
    if (saved && saved in IDX) return saved;
  } catch { /* ignore */ }
  const nav = (navigator.language || 'en').slice(0, 2) as Lang;
  return nav in IDX ? nav : 'en';
}

const current = signal<Lang>(initial());
document.documentElement.lang = current();

/** Translate a key; {name}-style placeholders are filled from params. Falls back to English, then the key. */
export function t(key: string, params?: Record<string, string | number>): string {
  const row = T[key];
  let s = row ? (row[IDX[current()]] || row[0]) : key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function currentLang(): Lang { return current(); }

export function speechLang(): string { return LANGS.find(l => l.code === current())!.speech; }

@Injectable({ providedIn: 'root' })
export class I18n {
  readonly lang = current.asReadonly();
  /** Called when the language changes, to save it on the account (for notifications). */
  onChange?: (l: Lang) => void;

  set(l: Lang): void {
    current.set(l);
    this.onChange?.(l);
    document.documentElement.lang = l;
    try { localStorage.setItem('crimespot.lang', l); } catch { /* ignore */ }
  }
}

/** {{ 'nav.map' | t }}  /  {{ 'alert.call' | t: { name: a.name } }}  (impure so it updates when the language changes) */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  transform(key: string, params?: Record<string, string | number>): string { return t(key, params); }
}

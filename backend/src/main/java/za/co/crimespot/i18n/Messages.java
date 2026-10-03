package za.co.crimespot.i18n;

import java.util.Map;
import java.util.Set;

/**
 * Server-side text (push notifications, in-app notices, key error messages) in
 * [English, Afrikaans, isiZulu, isiXhosa]. Same review rule as the web app: non-English text must be
 * checked by native speakers before launch. Missing cells fall back to English.
 */
public final class Messages {
    private Messages() {}

    public static final Set<String> LANGS = Set.of("en", "af", "zu", "xh");

    private static final Map<String, String[]> T = Map.ofEntries(
        e("push.sos.title", "🚨 {name} needs help", "🚨 {name} het hulp nodig", "🚨 U-{name} udinga usizo", "🚨 U-{name} ufuna uncedo"),
        e("push.sos.body", "Tap to see where they are and call them.", "Tik om te sien waar hulle is en bel hulle.", "Thepha ukuze ubone ukuthi ukuphi futhi umshayele.", "Cofa ukuze ubone ukuba uphi uze umtsalele."),
        e("push.safe.title", "{name} is safe", "{name} is veilig", "U-{name} uphephile", "U-{name} ukhuselekile"),
        e("push.safe.body", "{name} ended their emergency alert.", "{name} het hul noodwaarskuwing beëindig.", "U-{name} uqede isexwayiso sakhe.", "U-{name} uphelise isilumkiso sakhe."),
        e("push.share.title", "{name} is sharing their location", "{name} deel hul ligging", "U-{name} wabelana ngendawo akuyo", "U-{name} wabelana ngendawo akuyo"),
        e("push.share.body", "Tap to see where they are.", "Tik om te sien waar hulle is.", "Thepha ukuze ubone ukuthi ukuphi.", "Cofa ukuze ubone ukuba uphi."),
        e("push.checkin.title", "{name} checked in safely", "{name} het veilig ingeteken", "U-{name} ufike ephephile", "U-{name} ufike ekhuselekile"),
        e("push.checkin.body", "{name} has arrived and stopped sharing.", "{name} het aangekom en opgehou deel.", "U-{name} ufikile futhi uyekile ukwabelana.", "U-{name} ufikile kwaye uyekile ukwabelana."),
        e("push.friendReq.title", "New friend request", "Nuwe vriendskapsversoek", "Isicelo esisha sobungane", "Isicelo esitsha sobuhlobo"),
        e("push.friendReq.body", "{name} wants to add you on CrimeSpot.", "{name} wil jou op CrimeSpot byvoeg.", "U-{name} ufuna ukukwengeza ku-CrimeSpot.", "U-{name} ufuna ukukongeza kwi-CrimeSpot."),
        e("push.friendAcc.title", "Friend request accepted", "Vriendskapsversoek aanvaar", "Isicelo sobungane samukelwe", "Isicelo sobuhlobo samkelwe"),
        e("push.friendAcc.body", "{name} accepted your friend request.", "{name} het jou versoek aanvaar.", "U-{name} wamukele isicelo sakho.", "U-{name} wamkele isicelo sakho."),
        e("push.area.title", "Verified {type} {dist} from home", "Bevestigde {type} {dist} van die huis", "{type} eqinisekisiwe {dist} ukusuka ekhaya", "{type} eqinisekisiweyo {dist} ukusuka ekhaya"),
        e("push.area.body", "Tap to see it on the map.", "Tik om dit op die kaart te sien.", "Thepha ukuze ukubone emephini.", "Cofa ukuze ukubone kwimephu."),
        e("push.comment.title", "New comment on your report", "Nuwe kommentaar op jou verslag", "Amazwana amasha embikweni wakho", "Izimvo ezintsha kwingxelo yakho"),
        e("push.walk.request.title", "{name} asked you to walk with them", "{name} vra jou om saam met hulle te stap", "U-{name} ucela ukuthi uhambe naye", "U-{name} ucela ukuba uhambe naye"),
        e("push.walk.request.body", "Tap to accept and follow them until they arrive.", "Tik om te aanvaar en hulle te volg tot hulle aankom.", "Thepha ukuze wamukele futhi umlandele aze afike.", "Cofa ukuze wamkele uze umlandele ade afike."),
        e("push.walk.accepted.title", "{name} is walking with you", "{name} stap saam met jou", "U-{name} uhamba nawe", "U-{name} uhamba nawe"),
        e("push.walk.accepted.body", "They can see you until you arrive.", "Hulle kan jou sien tot jy aankom.", "Bayakubona uze ufike.", "Bayakubona ude ufike."),
        e("push.walk.still.title", "{name} hasn't moved for 3 minutes", "{name} het 3 minute lank nie beweeg nie", "U-{name} akanyakazanga imizuzu emi-3", "U-{name} akashukumanga imizuzu emi-3"),
        e("push.walk.still.body", "Check on them. Tap to see where they are.", "Kyk of hulle oukei is. Tik om te sien waar hulle is.", "Bheka ukuthi uyaphila yini. Thepha ukuze ubone ukuthi ukuphi.", "Jonga ukuba uphilile na. Cofa ukuze ubone ukuba uphi."),
        e("push.walk.lost.title", "Lost contact with {name}", "Kontak met {name} verloor", "Ukuxhumana no-{name} kulahlekile", "Unxibelelwano no-{name} lulahlekile"),
        e("push.walk.lost.body", "Their location stopped updating. Try calling them.", "Hul ligging het opgehou opdateer. Probeer hulle bel.", "Indawo yakhe iyekile ukubuyekezwa. Zama ukumshayela.", "Indawo yakhe iyekile ukuhlaziywa. Zama ukumtsalela."),
        e("push.walk.arrived.title", "{name} arrived safely", "{name} het veilig aangekom", "U-{name} ufike ephephile", "U-{name} ufike ekhuselekile"),
        e("push.walk.arrived.body", "Thanks for walking with them.", "Dankie dat jy saam met hulle gestap het.", "Siyabonga ngokuhamba naye.", "Enkosi ngokuhamba naye."),
        e("push.group.alert.title", "{group}: alert", "{group}: waarskuwing", "{group}: isexwayiso", "{group}: isilumkiso"),
        e("push.outage.title", "Power out near {place}", "Krag af naby {place}", "Ugesi ucimile eduze kwe-{place}", "Umbane ucimile kufutshane ne-{place}"),
        e("push.outage.body", "Reported by {n} people nearby.", "Deur {n} mense naby aangemeld.", "Kubikwe ngabantu abangu-{n} abaseduze.", "Kuxelwe ngabantu aba-{n} abakufutshane."),
        e("push.outage.hotspot", "This area is a crime hotspot. Stay alert and keep a torch ready.", "Hierdie area is 'n misdaadbrandpunt. Bly waaksaam en hou 'n flits gereed.",
          "Le ndawo inobugebengu obuningi. Qaphela futhi ube nethoshi.", "Le ndawo inolwaphulo-mthetho oluninzi. Lumka kwaye ube netotshi."),

        e("err.filter.phone", "Please don't share phone numbers. Contact details stay private on CrimeSpot.", "Moet asseblief nie foonnommers deel nie.", "Sicela ungabelani ngezinombolo zocingo.", "Nceda ungabelani ngeenombolo zefowuni."),
        e("err.filter.email", "Please don't share email addresses.", "Moet asseblief nie e-posadresse deel nie.", "Sicela ungabelani ngamakheli e-imeyili.", "Nceda ungabelani ngeedilesi ze-imeyile."),
        e("err.filter.id", "Please don't share ID numbers.", "Moet asseblief nie ID-nommers deel nie.", "Sicela ungabelani ngezinombolo zomazisi.", "Nceda ungabelani ngeenombolo zesazisi."),
        e("err.filter.plate", "Vehicle registration numbers can identify people, so they aren't allowed here. Give them to SAPS on 10111.",
          "Registrasienommers kan mense identifiseer, so dit word nie hier toegelaat nie. Gee dit aan die SAPD by 10111.",
          "Izinombolo zokubhaliswa kwezimoto zingaveza abantu, ngakho azivunyelwe lapha. Zinike i-SAPS ku-10111.",
          "Iinombolo zobhaliso lwezithuthi zinokuchaza abantu, ngoko azivumelekanga apha. Zinike i-SAPS ku-10111."),
        e("err.filter.threat", "Calls for violence or taking the law into your own hands aren't allowed. Report it to SAPS instead.",
          "Oproepe tot geweld of eie regspraak word nie toegelaat nie. Rapporteer dit eerder aan die SAPD.",
          "Ukugqugquzela udlame noma ukuzithathela umthetho akuvunyelwe. Kubike ku-SAPS.",
          "Ukukhuthaza ubundlobongela okanye ukuzithathela umthetho akuvumelekanga. Kuxele kwi-SAPS."),
        e("err.filter.hate", "Hateful language isn't allowed on CrimeSpot.", "Haatlike taal word nie op CrimeSpot toegelaat nie.", "Ulimi lwenzondo aluvunyelwe ku-CrimeSpot.", "Ulwimi lwentiyo aluvumelekanga kwi-CrimeSpot."),
        e("err.filter.masked", "Some words were hidden.", "Sommige woorde is versteek.", "Amanye amagama afihliwe.", "Amanye amagama afihliwe."),
        e("err.comment.empty", "Write a comment first.", "Skryf eers 'n kommentaar.", "Bhala amazwana kuqala.", "Bhala izimvo kuqala."),
        e("err.comment.long", "Keep comments under 1,000 characters.", "Hou kommentaar onder 1 000 karakters.", "Gcina amazwana engaphansi kwezinhlamvu ezi-1 000.", "Gcina izimvo zingaphantsi koonobumba abangama-1 000."),
        e("err.comment.rate", "You're commenting a lot. Wait a few minutes and try again.", "Jy lewer baie kommentaar. Wag 'n paar minute.", "Uphawula kakhulu. Linda imizuzu embalwa.", "Uphawula kakhulu. Linda imizuzu embalwa."),

        e("crime.ROBBERY", "robbery", "roof", "ukuphanga", "ukuphanga"),
        e("crime.HIJACKING", "hijacking", "kaping", "ukudunwa kwemoto", "ukuxhwilwa kwesithuthi"),
        e("crime.ASSAULT", "assault", "aanranding", "ukuhlaselwa", "uhlaselo"),
        e("crime.BURGLARY", "burglary", "inbraak", "ukugqekeza", "ukuqhekeza"),
        e("crime.THEFT", "theft", "diefstal", "ukweba", "ubusela"),
        e("crime.DRUG_RELATED", "drug-related incident", "dwelmverwante voorval", "isehlakalo sezidakamizwa", "isiganeko seziyobisi"),
        e("crime.FRAUD", "fraud", "bedrog", "ukukhwabanisa", "ubuqhetseba"),
        e("crime.VANDALISM", "vandalism", "vandalisme", "ukucekela phansi impahla", "ukonakalisa impahla"),
        e("crime.SUSPICIOUS_ACTIVITY", "suspicious activity", "verdagte aktiwiteit", "okusolisayo", "izenzo ezikrokrisayo"),
        e("crime.OTHER", "incident", "voorval", "isehlakalo", "isiganeko"));

    private static Map.Entry<String, String[]> e(String key, String en, String af, String zu, String xh) {
        return Map.entry(key, new String[] { en, af, zu, xh });
    }

    public static boolean has(String key) { return T.containsKey(key); }

    public static String t(String lang, String key, Map<String, ?> params) {
        String[] row = T.get(key);
        int i = switch (lang == null ? "en" : lang) { case "af" -> 1; case "zu" -> 2; case "xh" -> 3; default -> 0; };
        String s = row == null ? key : (row[i] == null || row[i].isBlank() ? row[0] : row[i]);
        if (params != null) for (var p : params.entrySet()) s = s.replace("{" + p.getKey() + "}", String.valueOf(p.getValue()));
        return s;
    }

    public static String t(String lang, String key) { return t(lang, key, null); }
}

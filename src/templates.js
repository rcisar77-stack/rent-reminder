const templates = {
  en: {
    before: `Dear {TENANT},

This is a friendly reminder regarding your upcoming rent payment for period {PERIOD}.

Payment Details:
Amount: {AMOUNT} {CURRENCY}
Due Date: {DUE_DATE}
Bank Account: {ACCOUNT_NUMBER}/{BANK_CODE} (IBAN: {IBAN})
Payment Reference: {VS}

Thank you and best regards.`,
    after: `Dear {TENANT},

Our records indicate that we have not yet received your rent payment due on {DUE_DATE} for period {PERIOD}.

Payment Details:
Amount: {AMOUNT} {CURRENCY}
Bank Account: {ACCOUNT_NUMBER}/{BANK_CODE} (IBAN: {IBAN})
Payment Reference: {VS}

If you have already sent your payment, please disregard this notice. Otherwise, please remit payment at your earliest convenience.

Thank you.`
  },
  cs: {
    before: `Vážený/á {NAJEMNIK},

připomínáme nadcházející splatnost nájemného za období {OBDOBI}.

Detaily platby:
Částka: {CASTKA} {MENA}
Splatnost do: {DATUM_SPLATNOSTI}
Bankovní účet: {CISLO_UCTU}/{KOD_BANKY} (IBAN: {IBAN})
Variabilní symbol: {VS}

Děkujeme a přejeme hezký den.`,
    after: `Vážený/á {NAJEMNIK},

upozorňujeme, že ke dni {DATUM_SPLATNOSTI} nebylo evidováno úhradě nájemného za období {OBDOBI}.

Detaily k úhradě:
Částka: {CASTKA} {MENA}
Bankovní účet: {CISLO_UCTU}/{KOD_BANKY} (IBAN: {IBAN})
Variabilní symbol: {VS}

Pokud jste platbu již odeslali, považujte prosím tuto zprávu za bezpředmětnou. V opačném případě Vás prosíme o neprodlenou úhradu.

Děkujeme.`
  },
  de: {
    before: `Sehr geehrte/r Frau/Herr {MIETER},

hiermit erinnern wir Sie an die bevorstehende Mietzahlung für den Zeitraum {ZEITRAUM}.

Zahlungsdetails:
Betrag: {BETRAG} {WAEHRUNG}
Fällig am: {FAELLIGKEITSDATUM}
Bankverbindung: {KONTONUMMER}/{BANKLEITZAHL} (IBAN: {IBAN})
Verwendungszweck: {VERWENDUNGSZWECK}

Vielen Dank und freundliche Grüße.`,
    after: `Sehr geehrte/r Frau/Herr {MIETER},

laut unseren Unterlagen ist die Mietzahlung für den Zeitraum {ZEITRAUM} (fällig am {FAELLIGKEITSDATUM}) noch nicht eingegangen.

Zahlungsdetails:
Betrag: {BETRAG} {WAEHRUNG}
Bankverbindung: {KONTONUMMER}/{BANKLEITZAHL} (IBAN: {IBAN})
Verwendungszweck: {VERWENDUNGSZWECK}

Sollten Sie die Zahlung bereits angewiesen haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.

Vielen Dank.`
  },
  es: {
    before: `Estimado/a {INQUILINO},

Le recordamos que se aproxima el vencimiento del pago del alquiler correspondiente al periodo {PERIODO}.

Detalles del pago:
Monto: {MONTO} {MONEDA}
Fecha límite: {FECHA_VENCIMIENTO}
Cuenta Bancaria: {NUMERO_CUENTA}/{CODIGO_BANCO} (IBAN: {IBAN})
Referencia de pago: {REFERENCIA}

Muchas gracias y un cordial saludo.`,
    after: `Estimado/a {INQUILINO},

Le informamos que hasta la fecha no hemos registrado el pago del alquiler correspondiente al periodo {PERIODO} (vencido el {FECHA_VENCIMIENTO}).

Detalles del pago:
Monto: {MONTO} {MONEDA}
Cuenta Bancaria: {NUMERO_CUENTA}/{CODIGO_BANCO} (IBAN: {IBAN})
Referencia de pago: {REFERENCIA}

Si ya ha realizado la transferencia, por favor ignore este aviso. En caso contrario, le rogamos realice el pago a la brevedad.

Gracias.`
  },
  fr: {
    before: `Bonjour {LOCATAIRE},

Nous vous rappelons l'échéance prochaine de votre loyer pour la période {PERIODE}.

Détails du paiement :
Montant : {MONTANT} {DEVISE}
Échéance : {DATE_ECHEANCE}
Compte Bancaire : {NUMERO_COMPTE}/{CODE_BANQUE} (IBAN : {IBAN})
Référence : {REFERENCE}

Merci et cordialement.`,
    after: `Bonjour {LOCATAIRE},

Sauf erreur de notre part, nous n'avons pas encore reçu le paiement de votre loyer pour la période {PERIODE} (échéance le {DATE_ECHEANCE}).

Détails du paiement :
Montant : {MONTANT} {DEVISE}
Compte Bancaire : {NUMERO_COMPTE}/{CODE_BANQUE} (IBAN : {IBAN})
Référence : {REFERENCE}

Si votre virement a déjà été effectué, veuillez ne pas tenir compte de ce message.

Merci.`
  }
};

module.exports = templates;

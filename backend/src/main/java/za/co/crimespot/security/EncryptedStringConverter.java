package za.co.crimespot.security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {
    @Override public String convertToDatabaseColumn(String value) { return FieldCrypto.encrypt(value); }
    @Override public String convertToEntityAttribute(String db) { return FieldCrypto.decrypt(db); }
}

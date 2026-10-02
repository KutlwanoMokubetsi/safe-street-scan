package za.co.crimespot.security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class EncryptedDoubleConverter implements AttributeConverter<Double, String> {
    @Override public String convertToDatabaseColumn(Double value) {
        return value == null ? null : FieldCrypto.encrypt(Double.toString(value));
    }
    @Override public Double convertToEntityAttribute(String db) {
        String plain = FieldCrypto.decrypt(db);
        return plain == null ? null : Double.valueOf(plain);
    }
}

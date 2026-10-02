package za.co.crimespot.user;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** What friends see during your SOS, if you choose to share it. Stored encrypted as JSON. */
public record EmergencyInfo(
        @Size(max = 10) String bloodType,
        @Size(max = 300) String allergies,
        @Size(max = 300) String medications,
        @Size(max = 300) String conditions,
        @Size(max = 80) String medicalAid,
        @Size(max = 40) String medicalAidNumber,
        @Size(max = 80) String contactName,
        @Size(max = 30) @Pattern(regexp = "^$|^[+0-9 ()-]{7,30}$", message = "must be a phone number") String contactPhone,
        @Size(max = 40) String contactRelation,
        @Size(max = 500) String notes) {}

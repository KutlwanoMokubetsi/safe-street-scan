package za.co.crimespot.report;

/** Severity is used to weight hotspot scores; violent crime counts for more. */
public enum CrimeType {
    ASSAULT(1.0), ROBBERY(1.0), HIJACKING(1.0),
    BURGLARY(0.8), THEFT(0.6), DRUG_RELATED(0.5),
    FRAUD(0.4), VANDALISM(0.4), SUSPICIOUS_ACTIVITY(0.3), OTHER(0.3);

    private final double severity;
    CrimeType(double severity) { this.severity = severity; }
    public double severity() { return severity; }
}

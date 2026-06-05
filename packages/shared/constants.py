"""Shared constants used by the CyberSaathi backend."""

from typing import Final


FRAUD_TYPES: Final[tuple[str, ...]] = (
    "upi_fraud",
    "banking_fraud",
    "wallet_fraud",
    "online_payment_fraud",
    "sextortion",
    "job_scam",
    "account_hack",
    "harassment",
    "phishing",
    "other",
)


PAYMENT_METHODS: Final[tuple[str, ...]] = (
    "upi",
    "card",
    "netbanking",
    "wallet",
    "cash",
    "none",
)


PIPELINES: Final[tuple[str, ...]] = (
    "golden_hour",
    "post_golden_hour",
    "fall_back",
)


SEVERITY_LEVELS: Final[tuple[str, ...]] = ("low", "medium", "high", "critical")


ACCOUNTABILITY_THRESHOLD: Final[int] = 50
ACCOUNTABILITY_WINDOW_DAYS: Final[int] = 30
GOLDEN_HOUR_MINUTES: Final[int] = 60


PUBLIC_AUTHORITIES: Final[dict[str, str]] = {
    "Andhra Pradesh": "Andhra Pradesh State Cyber Crime Bureau",
    "Assam": "Assam Police Cyber Cell",
    "Bihar": "Bihar Economic Offences Unit",
    "Chhattisgarh": "Chhattisgarh Cyber Cell",
    "Delhi": "Delhi Police Cyber Crime Cell",
    "Goa": "Goa Police Cyber Cell",
    "Gujarat": "Gujarat CID (Crime)",
    "Haryana": "Haryana State Crime Branch",
    "Himachal Pradesh": "Himachal Pradesh Cyber Cell",
    "Jharkhand": "Jharkhand Cyber Cell",
    "Karnataka": "Karnataka State CID Cyber Crime",
    "Kerala": "Kerala Police Cyber Cell",
    "Madhya Pradesh": "Madhya Pradesh Cyber Cell",
    "Maharashtra": "Maharashtra Cyber Cell",
    "Manipur": "Manipur Cyber Cell",
    "Meghalaya": "Meghalaya Cyber Cell",
    "Mizoram": "Mizoram Cyber Cell",
    "Nagaland": "Nagaland Cyber Cell",
    "Odisha": "Odisha Crime Branch",
    "Punjab": "Punjab State Cyber Cell",
    "Rajasthan": "Rajasthan Police Cyber Cell",
    "Sikkim": "Sikkim Cyber Cell",
    "Tamil Nadu": "Tamil Nadu Cyber Crime Cell",
    "Telangana": "Telangana Cyber Security Bureau",
    "Tripura": "Tripura Cyber Cell",
    "Uttar Pradesh": "UP Cyber Crime Cell",
    "Uttarakhand": "Uttarakhand Cyber Cell",
    "West Bengal": "West Bengal CID Cyber Cell",
}

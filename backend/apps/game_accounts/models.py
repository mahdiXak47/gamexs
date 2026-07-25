from django.conf import settings
from django.db import models


class PSNAccount(models.Model):
    REGION_NA = "NA"
    REGION_EU = "EU"
    REGION_IR = "IR"
    REGION_AS = "AS"
    REGION_CHOICES = [
        (REGION_NA, "North America"),
        (REGION_EU, "Europe"),
        (REGION_IR, "Iran"),
        (REGION_AS, "Asia"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="psn_accounts")
    nickname = models.CharField(max_length=200)
    psn_id = models.CharField(max_length=200)
    region = models.CharField(max_length=2, choices=REGION_CHOICES, default=REGION_IR)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "game_accounts_psnaccount"
        ordering = ["-added_at"]

    def __str__(self):
        return f"{self.user} / {self.psn_id}"

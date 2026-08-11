from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="GameReview",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("game_id", models.IntegerField()),
                ("rating", models.PositiveSmallIntegerField()),
                ("body", models.TextField()),
                ("status", models.CharField(choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")], default="pending", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="game_reviews", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "db_table": "reviews_gamereview",
                "ordering": ["-created_at"],
                "unique_together": {("user", "game_id")},
            },
        ),
        migrations.AddIndex(
            model_name="gamereview",
            index=models.Index(fields=["game_id", "status", "-created_at"], name="reviews_gam_game_id_c980b7_idx"),
        ),
        migrations.AddIndex(
            model_name="gamereview",
            index=models.Index(fields=["user", "game_id"], name="reviews_gam_user_id_3dbaca_idx"),
        ),
    ]

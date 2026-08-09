from django.db import models


class PS5Game(models.Model):
    title = models.CharField(max_length=512)
    slug = models.CharField(max_length=512)
    cover_url = models.TextField(null=True, blank=True)
    main_background_image_url = models.TextField(null=True, blank=True)
    igdb_id = models.IntegerField(null=True, blank=True)
    igdb_name = models.CharField(max_length=512, null=True, blank=True)
    genre_label = models.CharField(max_length=200, null=True, blank=True)
    publisher = models.CharField(max_length=200, null=True, blank=True)
    release_year = models.IntegerField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "ps5_games"

    def __str__(self):
        return self.title


class Seller(models.Model):
    name = models.CharField(max_length=200)
    domain = models.CharField(max_length=200)

    class Meta:
        managed = False
        db_table = "sellers"

    def __str__(self):
        return self.name


class Listing(models.Model):
    game = models.ForeignKey(PS5Game, on_delete=models.DO_NOTHING, db_constraint=False)
    seller = models.ForeignKey(Seller, on_delete=models.DO_NOTHING, db_constraint=False)
    product_type = models.CharField(max_length=50)
    tier = models.CharField(max_length=50, null=True, blank=True)
    source_url = models.TextField()
    current_price = models.IntegerField(null=True, blank=True)
    is_available = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = "listings"

    def __str__(self):
        return f"{self.game} @ {self.seller}"

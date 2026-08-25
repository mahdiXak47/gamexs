from django import forms
from django.contrib import admin
from django.forms.models import BaseModelFormSet

from .models import PS5Game, Seller


POSITION_FIELD_LABELS = {
    "hero_position": "Hero UI position",
    "preorder_hero_position": "Preorder hero UI position",
}


class PS5GameAdminForm(forms.ModelForm):
    class Meta:
        model = PS5Game
        fields = "__all__"

    def clean(self):
        cleaned_data = super().clean()
        queryset = PS5Game.objects.exclude(pk=self.instance.pk)
        for field_name in ("hero_position", "preorder_hero_position"):
            position = cleaned_data.get(field_name)
            if position is None:
                continue

            existing_game = queryset.filter(**{field_name: position}).first()
            if existing_game is not None:
                label = POSITION_FIELD_LABELS[field_name]
                self.add_error(
                    field_name,
                    f"{label} {position} is already used by \"{existing_game.title}\". "
                    f"Remove {position} from that game and save it first, then assign "
                    f"{position} to this game.",
                )
        return cleaned_data


class PS5GameFormSet(BaseModelFormSet):
    """Validate positions across all rows submitted by list_editable."""

    def clean(self):
        super().clean()
        if any(self.errors):
            return

        for field_name in ("hero_position", "preorder_hero_position"):
            seen = {}
            for form in self.forms:
                position = form.cleaned_data.get(field_name)
                if position is None:
                    continue
                previous_form = seen.get(position)
                if previous_form is not None:
                    label = POSITION_FIELD_LABELS[field_name]
                    form.add_error(
                        field_name,
                        f"{label} {position} is entered more than once in this edit. "
                        f"Remove {position} from one of the games, then save again.",
                    )
                else:
                    seen[position] = form


@admin.register(PS5Game)
class PS5GameAdmin(admin.ModelAdmin):
    form = PS5GameAdminForm
    list_display = (
        "title",
        "slug",
        "is_popular",
        "is_newest",
        "hero_position",
        "preorder_hero_position",
    )
    list_editable = ("is_popular", "is_newest", "hero_position", "preorder_hero_position")
    list_filter = ("is_popular", "is_newest")
    search_fields = ("title", "slug")
    ordering = ("title",)

    def get_changelist_form(self, request, **kwargs):
        """Use the position-validating form for list_editable rows."""
        kwargs.setdefault("form", self.form)
        return super().get_changelist_form(request, **kwargs)

    def get_changelist_formset(self, request, **kwargs):
        """Use cross-row validation for list_editable submissions."""
        return super().get_changelist_formset(request, formset=PS5GameFormSet, **kwargs)


@admin.register(Seller)
class SellerAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "domain", "is_active")
    list_editable = ("is_active",)
    list_filter = ("is_active",)
    search_fields = ("name", "slug", "domain")
    ordering = ("name",)

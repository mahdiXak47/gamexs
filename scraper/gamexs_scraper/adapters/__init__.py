from .pspro import PsProAdapter
from .yungcenter import YungCenterAdapter

ADAPTERS = {
    PsProAdapter.seller: PsProAdapter,
    YungCenterAdapter.seller: YungCenterAdapter,
}

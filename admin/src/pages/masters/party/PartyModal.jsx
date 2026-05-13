import React from "react";
import Modal from "../../../components/ui/Modal";

const PartyModal = ({ open = false, onClose = () => {}, children = null }) => (
    <Modal open={open} onClose={onClose} title="Party">
        {children || <p className="party-modal__placeholder">Party detail form placeholder.</p>}
    </Modal>
);

export default PartyModal;
